import {range} from 'lodash'

import {EvalResult, Log} from '../EvalResult'
import {scope, ValueContainer, valueContainer} from '../expr'
import {parse, parseModule} from '../parser'
import {
	All,
	boolean,
	BooleanType,
	Enum,
	enumType,
	False,
	Fn,
	fn,
	IFn,
	Never,
	Number,
	number,
	NumberType,
	String,
	string,
	StringType,
	True,
	unionType,
	Value,
	Vec,
	vec,
} from '../value'

interface Defn {
	(
		type: string,
		f: (...args: any[]) => Value,
		options?: {lazy?: false; writeLog?: false}
	): ValueContainer
	(
		type: string,
		f: (...args: any[]) => ReturnType<IFn>,
		options?: {lazy?: false; writeLog?: true}
	): ValueContainer
}

const defn: Defn = (type, f, {writeLog = false} = {}) => {
	const fnType = parse(type, PreludeScope).eval().value

	if (fnType.type !== 'FnType') throw new Error('Not a fnType:' + type)

	let _f: IFn

	if (writeLog) {
		_f = (...args) => f(...args) as ReturnType<IFn>
	} else {
		_f = (...args) => new EvalResult(f(...args) as Value)
	}

	const _fn = fn(fnType, _f)

	return valueContainer(_fn)
}

export const PreludeScope = scope({
	Number: valueContainer(NumberType),
	String: valueContainer(StringType),
	Boolean: valueContainer(BooleanType),
	_: valueContainer(All.instance),
	All: valueContainer(All.instance),
	Never: valueContainer(Never.instance),
})

PreludeScope.defs({
	union: defn('(=> [...types:_]: _)', (...types: Value[]) =>
		unionType(...types)
	),
})

PreludeScope.defs({
	true: valueContainer(True),
	false: valueContainer(False),
	log: defn(
		'(=> (T) [value:T level:(union "error" "warn" "info") reason:String]: T)',
		(value: Value, level: String, reason: String) =>
			new EvalResult(value).withLog({
				level: level.value as Log['level'],
				reason: reason.value,
			}),
		{writeLog: true}
	),
	'+': defn('(=> [...xs:Number]: Number)', (...xs: Number[]) =>
		number(xs.reduce((sum, x) => sum + x.value, 0))
	),
	'-': defn('(=> [...xs:^{default: 1} Number]: Number)', (...xs: Number[]) => {
		switch (xs.length) {
			case 0:
				return number(0)
			case 1:
				return number(-xs[0].value)
			default:
				return number(
					xs.slice(1).reduce((prev, x) => prev - x.value, xs[0].value)
				)
		}
	}),
	'*': defn('(=> [...xs:^{default: 1} Number]: Number)', (...xs: Number[]) =>
		number(xs.reduce((prod, x) => prod * x.value, 1))
	),
	div: defn('(=> [...xs:^{default: 1} Number]: Number)', (...xs: Number[]) => {
		switch (xs.length) {
			case 0:
				return number(1)
			case 1:
				return number(1 / xs[0].value)
			default:
				return number(
					xs.slice(1).reduce((prev, x) => prev / x.value, xs[0].value)
				)
		}
	}),
	'**': defn(
		'(=> [x:Number a:^{default: 1} Number]: Number)',
		(x: Number, a: Number) => number(Math.pow(x.value, a.value))
	),
	'%': defn('(=> [x:Number y:Number]: Number)', (x: Number, y: Number) =>
		number(x.value % y.value)
	),
	'<': defn('(=> [x:Number y:Number]: Boolean)', (x: Number, y: Number) =>
		boolean(x.value < y.value)
	),
	'==': defn('(=> [x:Number y:Number]: Boolean)', (x: Value, y: Value) =>
		boolean(x.isEqualTo(y))
	),
	'&&': defn(
		'(=> [...xs:^{default: true} Boolean]: Boolean)',
		(...xs: Value[]) => {
			for (const x of xs) {
				if (x.isEqualTo(False)) return False
			}
			return True
		}
	),
	'||': defn('(=> [...xs:Boolean]: Boolean)', (...xs: Value[]) => {
		for (const x of xs) {
			if (x.isEqualTo(True)) return True
		}
		return False
	}),
	'!': defn('(=> [x:Boolean]: Boolean)', (x: Enum) =>
		boolean(x.isEqualTo(False))
	),
	len: defn('(=> [x:(union String [..._])]: Number)', (x: String | Vec) => {
		if (x.type === 'Vec') return number(x.items.length)
		else return number(x.value.length)
	}),
	range: defn(
		'(=> [start:Number end:Number ?step:^{default: 1}Number]: [...Number])',
		(start: Number, end: Number, step: Number) =>
			vec(range(start.value, end.value, step.value).map(number))
	),
	rest: defn('(=> (T) [coll:[...T]]: [...T])', (coll: Vec) =>
		vec(coll.items.slice(1))
	),
	map: defn(
		'(=> (T U) [f: (=> [t:T]: U) coll:[...T]]: [...U])',
		(f: Fn, coll: Vec) => {
			const [items, info] = EvalResult.map(coll.items, f.fn).asArray
			return new EvalResult(vec(items), info)
		},
		{writeLog: true}
	),
	filter: defn(
		'(=> (T) [pred: (=> [x: T]: Boolean) coll: [...T]]: [...T])',
		(f: Fn, coll: Vec) => {
			const items = coll.items.filter(it => {
				return f.fn(it).value.isEqualTo(True)
			})
			return vec(items)
		}
	),
	reduce: defn(
		'(=> (T U) [f: (=> [u:U t:T]: U) coll: [...T] initial: U]: U)',
		(f: Fn, coll: Vec, initial: Value) => {
			return coll.items.reduce(
				(prev: Value, curt: Value) => f.fn(prev, curt).value,
				initial
			)
		}
	),
	enum: defn(
		'(=> [name:String ...label:String]: _)',
		(name: String, ...labels: String[]) =>
			enumType(
				name.value,
				labels.map(l => l.value)
			)
	),
	fnType: defn('(=> [f:_]: _)', (f: Value) => ('fnType' in f ? f.fnType : f)),
	'subtype?': defn('(=> [x:_ y:_]: Boolean)', (x: Value, y: Value) =>
		boolean(x.isSubtypeOf(y))
	),
	show: defn('(=> [value:_]: String)', (value: Value) => string(value.print())),
	'++': defn('(=> [...xs:String]: String)', (...xs: String[]) => {
		return string(xs.reduce((a, b) => a + b, ''))
	}),
	join: defn(
		'(=> [delimiter: String ...xs: String]: String)',
		(delimiter: String, ...xs: String[]) => {
			return string(xs.map(x => x.value).join(delimiter.value))
		}
	),
	'truthy?': defn('(=> [value: _]: Boolean)', (value: Value) => {
		// Returns true if the value is either of () or belows:
		// false, 0, -0, 0n, "", null, undefined, and NaN.
		// ref: https://developer.mozilla.org/en-US/docs/Glossary/Truthy

		if (value.type === 'Unit') {
			return False
		}

		if (value.type === 'Prim') {
			if (!value.value) {
				return False
			}
		}
		return True
	}),
})

PreludeScope.defs(
	parseModule(`

if: (=> (T) [test:_ then:T else:T]
      (match _: (truthy? test)
             true: then
             false: else))
	

<=: (=> [x:Number y:Number] (|| (== x y) (< x y)))
>: (=> [x:Number y:Number] (< y x))
>=: (=> [x:Number y:Number] (<= y x))

inc: (=> [x:Number] (+ x 1))
dec: (=> [x:Number] (- x 1))

even?: (=> [x:Number] (== (% x 2) 0))

compose: (=> (T U V) [f:(=> [t:T]: U) g:(=> [u:U]: V)]
             (=> [x:T] (g (f x))))

first: (=> (T) [coll:[...T]] (coll 0))

id: (=> (T) [x:T] x)

sqrt: (=> [x:Number]
        (match r: (<= 0 x)
               true: (** x 0.5)
               (log 0 "warn" "Negative Number")))

square: (=> [x:Number] (** x 2))

hypot:  (=> [x:Number y:Number] (sqrt (+ (* x x) (* y y))))

$%: (=> [percent:Number] (div percent 100))
$rad: (=> [radians:Number] (div (* radians 180) PI))
$turn: (=> [turns:Number] (* turns 360))
$e: (=> [coeff:Number exponent:Number]
        (* coeff (** 10 exponent)))

PI: 3.1415926535897932384626433832795028841971693993
	`)
)

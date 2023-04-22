import {range} from 'lodash'

import {container, FnDef, scope} from '../expr'
import {Log} from '../Log'
import {parse, parseModule} from '../parser'
import {
	All,
	boolean,
	BooleanType,
	Enum,
	enumType,
	False,
	Fn,
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

function defn(type: string, f: IFn): FnDef {
	const parsed = parse(type)

	if (!parsed.expr) throw new Error('Not a fnType')

	const fnType = parsed.expr

	if (fnType.type !== 'FnDef') throw new Error('Not a fnType:' + fnType.type)

	return new FnDef(fnType.typeVars, fnType.params, fnType.returnType, {
		type: 'NativeFnBody',
		f,
	})
}

export const PreludeScope = scope({
	Number: container(NumberType),
	String: container(StringType),
	Boolean: container(BooleanType),
	_: container(All.instance),
	All: container(All.instance),
	Never: container(Never.instance),
	union: defn('(=> [...types:_]: _)', (...types: Value[]) =>
		unionType(...types)
	),
	true: container(True),
	false: container(False),
	log: defn(
		'(=> (T) [value:T level:(union "error" "warn" "info") reason:String]: T)',
		(value: Value, level: String, reason: String) =>
			value.withLog({
				level: level.value as Log['level'],
				reason: reason.value,
			})
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
	'==': defn('(=> [x:_ y:_]: Boolean)', (x: Value, y: Value) =>
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
			return vec(coll.items.map(f.fn))
		}
	),
	filter: defn(
		'(=> (T) [pred: (=> [x: T]: Boolean) coll: [...T]]: [...T])',
		(f: Fn, coll: Vec) => {
			const items = coll.items.filter(it => {
				return f.fn(it).isEqualTo(True)
			})
			return vec(items)
		}
	),
	reduce: defn(
		'(=> (T U) [f: (=> [u:U t:T]: U) coll: [...T] initial: U]: U)',
		(f: Fn, coll: Vec, initial: Value) => {
			return coll.items.reduce(
				(prev: Value, curt: Value) => f.fn(prev, curt),
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

sqrt: 
^{doc: "Returns a square root of \`x\`"
  returns: "The square root of \`x\`, a nonnegative number. If \`x < 0\`, returns \`0\`"}
(=> [x: ^{doc: "A number greater than or equal to 0"
          min: 0}
        Number]
    (match r: (<= 0 x)
           true: (** x 0.5)
           (log 0 "warn" "Negative Number")))

hypot:
^{doc: "Retruns the square root of the sum of squares of its arguments"}
(=> [x:Number y:Number] (sqrt (+ (* x x) (* y y))))

$%: (=> [percent:Number] (div percent 100))
$rad: (=> [radians:Number] (div (* radians 180) PI))
$turn: (=> [turns:Number] (* turns 360))
$e: (=> [coeff:Number exponent:Number]
        (* coeff (** 10 exponent)))

PI: 3.1415926535897932384626433832795028841971693993
E: 2.71828182845904523536028747135266249
	`)
)

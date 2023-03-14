import {range} from 'lodash'

import {Arg, scope, ValueContainer, valueContainer} from '../expr'
import {Log, withLog} from '../log'
import {parse, parseModule} from '../parser'
import {Writer} from '../util/Writer'
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
		f: (...args: Arg<any>[]) => Value,
		options?: {lazy?: true; writeLog?: false}
	): ValueContainer
	(
		type: string,
		f: (...args: any[]) => Value,
		options?: {lazy?: false; writeLog?: false}
	): ValueContainer
	(
		type: string,
		f: IFn,
		options?: {lazy?: true; writeLog?: true}
	): ValueContainer
	(
		type: string,
		f: (...args: any[]) => ReturnType<IFn>,
		options?: {lazy?: false; writeLog?: true}
	): ValueContainer
}

const defn: Defn = (type, f, {lazy = false, writeLog = false} = {}) => {
	const fnType = parse(type, PreludeScope).eval().result

	if (fnType.type !== 'FnType') throw new Error('Not a fnType:' + type)

	let _f: IFn

	if (writeLog) {
		_f = lazy
			? (f as IFn)
			: (...args) => f(...args.map(a => a())) as ReturnType<IFn>
	} else {
		_f = lazy
			? (...args) => withLog(f(...args) as Value)
			: (...args) => withLog(f(...args.map(a => a())) as Value)
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
			Writer.of(value, {
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
	'==': defn('(=> [...xs:_]: Boolean)', (x: Value, y: Value) =>
		boolean(x.isEqualTo(y))
	),
	if: defn(
		'(=> (T) [test:Boolean then:T else:T]: T)',
		(test: Arg, then: Arg, _else: Arg) =>
			test().isEqualTo(True) ? then() : _else(),
		{lazy: true}
	),
	'&&': defn(
		'(=> [...xs:^{default: true} Boolean]: Boolean)',
		(...xs: Arg<Enum>[]) => {
			for (const x of xs) {
				if (x().isEqualTo(False)) return boolean(false)
			}
			return boolean(true)
		},
		{lazy: true}
	),
	'||': defn(
		'(=> [...xs:Boolean]: Boolean)',
		(...xs: Arg<Enum>[]) => {
			for (const x of xs) {
				if (x().isEqualTo(True)) return boolean(true)
			}
			return boolean(false)
		},
		{lazy: true}
	),
	'!': defn('(=> [x:Boolean]: Boolean)', (x: Enum) =>
		boolean(x.isEqualTo(False))
	),
	len: defn('(=> [x:(union String [..._])]: Number)', (x: String | Vec) => {
		if (x.type === 'Vec') return number(x.items.length)
		else return number(x.value.length)
	}),
	range: defn(
		'(=> [start:Number end:Number step?:^{default: 1}Number]: [...Number])',
		(start: Number, end: Number, step: Number) =>
			vec(range(start.value, end.value, step.value).map(number))
	),
	rest: defn('(=> (T) [coll:[...T]]: [...T])', (coll: Vec) =>
		vec(coll.items.slice(1))
	),
	map: defn(
		'(=> (T U) [f: (=> [t:T]: U) coll:[...T]]: [...U])',
		(f: Fn, coll: Vec) => {
			const [items] = Writer.map(coll.items, i => f.fn(() => i)).asTuple
			return vec(items)
		}
	),
	reduce: defn(
		'(=> (T U) [f: (=> [u:U t:T]: U) coll: [...T] initial: U]: U)',
		(f: Fn, coll: Vec, initial: Value) => {
			return coll.items.reduce(
				(prev: Value, curt: Value) =>
					f.fn(
						() => prev,
						() => curt
					).result,
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
	isSubtype: defn('(=> [x:_ y:_]: Boolean)', (x: Value, y: Value) =>
		boolean(x.isSubtypeOf(y))
	),
	show: defn('(=> [value:_]: String)', (value: Value) => string(value.print())),
	'++': defn('(=> [a:String b:String]: String)', (a: String, b: String) =>
		string(a.value + b.value)
	),
	try: defn(
		'(=> (T) [block: T handler: T]: T)',
		(block: Arg, handler: Arg) => {
			try {
				return block()
			} catch (e) {
				return handler()
			}
		},
		{lazy: true}
	),
})

PreludeScope.defs(
	parseModule(`
<=: (=> [x:Number y:Number] (|| (== x y) (< x y)))
>: (=> [x:Number y:Number] (< y x))
>=: (=> [x:Number y:Number] (<= y x))

inc: (=> [x:Number] (+ x 1))
dec: (=> [x:Number] (- x 1))

isEven: (=> [x:Number] (== (% x 2) 0))

compose: (=> (T U V) [f:(=> [t:T]: U) g:(=> [u:U]: V)]
             (=> [x:T] (g (f x))))

const: (=> (T) [x:T] (=> [] x))

first: (=> (T) [coll:[...T]] (coll 0))

id: (=> (T) [x:T] x)

sqrt: (=> [x:Number] (if (<= 0 x)
											(** x 0.5)
											(log 0 "warn" "Negative number")))

square: (=> [x:Number] (** x 2))

hypot:  (=> [x:Number y:Number] (sqrt (+ (* x x) (* y y))))

PI: 3.1415926535897932384626433832795028841971693993
	`)
)

import {range} from 'lodash'

import * as Expr from '../expr'
import {Log, withLog} from '../log'
import {parse, parseModule} from '../parser'
import {Writer} from '../util/Writer'
import {
	All,
	bool,
	BoolType,
	Enum,
	enumType,
	False,
	Fn,
	fnFrom,
	IFn,
	isEqual,
	Never,
	Num,
	num,
	NumType,
	Str,
	str,
	StrType,
	True,
	unionType,
	Value,
	Vec,
	vec,
} from '../value'

interface Defn {
	(
		type: string,
		f: (...args: Expr.Arg<any>[]) => Value,
		options?: {lazy?: true; writeLog?: false}
	): Expr.ValueContainer
	(
		type: string,
		f: (...args: any[]) => Value,
		options?: {lazy?: false; writeLog?: false}
	): Expr.ValueContainer
	(
		type: string,
		f: IFn,
		options?: {lazy?: true; writeLog?: true}
	): Expr.ValueContainer
	(
		type: string,
		f: (...args: any[]) => ReturnType<IFn>,
		options?: {lazy?: false; writeLog?: true}
	): Expr.ValueContainer
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

	const fn = fnFrom(fnType, _f)

	return Expr.value(fn)
}

export const PreludeScope = Expr.scope({
	Num: Expr.value(NumType),
	Str: Expr.value(StrType),
	Bool: Expr.value(BoolType),
	_: Expr.value(All.instance),
	All: Expr.value(All.instance),
	Never: Expr.value(Never.instance),
})

PreludeScope.defs({
	union: defn('(-> [...types:_] _)', (...types: Value[]) =>
		unionType(...types)
	),
})

PreludeScope.defs({
	true: Expr.value(True),
	false: Expr.value(False),
	log: defn(
		'(-> (T) [value:T level:(union "error" "warn" "info") reason:Str] T)',
		(value: Value, level: Str, reason: Str) =>
			Writer.of(value, {
				level: level.value as Log['level'],
				reason: reason.value,
			}),
		{writeLog: true}
	),
	'+': defn('(-> [...xs:Num] Num)', (...xs: Num[]) =>
		num(xs.reduce((sum, x) => sum + x.value, 0))
	),
	'-': defn('(-> [...xs:^{default: 1} Num] Num)', (...xs: Num[]) => {
		switch (xs.length) {
			case 0:
				return num(0)
			case 1:
				return num(-xs[0].value)
			default:
				return num(xs.slice(1).reduce((prev, x) => prev - x.value, xs[0].value))
		}
	}),
	'*': defn('(-> [...xs:^{default: 1} Num] Num)', (...xs: Num[]) =>
		num(xs.reduce((prod, x) => prod * x.value, 1))
	),
	'/': defn('(-> [...xs:^{default: 1} Num] Num)', (...xs: Num[]) => {
		switch (xs.length) {
			case 0:
				return num(1)
			case 1:
				return num(1 / xs[0].value)
			default:
				return num(xs.slice(1).reduce((prev, x) => prev / x.value, xs[0].value))
		}
	}),
	'**': defn('(-> [x:Num a:^{default: 1} Num] Num)', (x: Num, a: Num) =>
		num(Math.pow(x.value, a.value))
	),
	'%': defn('(-> [x:Num y:Num] Num)', (x: Num, y: Num) =>
		num(x.value % y.value)
	),
	'<': defn('(-> [x:Num y:Num] Bool)', (x: Num, y: Num) =>
		bool(x.value < y.value)
	),
	'==': defn('(-> [...xs:_] Bool)', (x: Value, y: Value) =>
		bool(isEqual(x, y))
	),
	if: defn(
		'(-> (T) [test:Bool then:T else:T] T)',
		(test: Expr.Arg, then: Expr.Arg, _else: Expr.Arg) =>
			isEqual(test(), True) ? then() : _else(),
		{lazy: true}
	),
	'&&': defn(
		'(-> [...xs:^{default: true} Bool] Bool)',
		(...xs: Expr.Arg<Enum>[]) => {
			for (const x of xs) {
				if (x().isEqualTo(False)) return bool(false)
			}
			return bool(true)
		},
		{lazy: true}
	),
	'||': defn(
		'(-> [...xs:Bool] Bool)',
		(...xs: Expr.Arg<Enum>[]) => {
			for (const x of xs) {
				if (x().isEqualTo(True)) return bool(true)
			}
			return bool(false)
		},
		{lazy: true}
	),
	'!': defn('(-> [x:Bool] Bool)', (x: Enum) => bool(x.isEqualTo(False))),
	len: defn('(-> [x:(union Str [..._])] Num)', (x: Str | Vec) => {
		if (x.type === 'Vec') return num(x.items.length)
		else return num(x.value.length)
	}),
	range: defn(
		'(-> [start:Num end:Num step?:^{default: 1}Num] [...Num])',
		(start: Num, end: Num, step: Num) =>
			vec(range(start.value, end.value, step.value).map(num))
	),
	gcd: defn(
		'(-> [x:Num y:Num] Num)',
		(() => {
			const gcd = (x: Num, y: Num): Num =>
				x.value % y.value ? gcd(y, num(x.value % y.value)) : y
			return gcd
		})()
	),
	rest: defn('(-> (T) [coll:[...T]] [...T])', (coll: Vec) =>
		vec(coll.items.slice(1))
	),
	map: defn(
		'(-> (T U) [f: (-> [t:T] U) coll:[...T]] [...U])',
		(f: Fn, coll: Vec) => {
			const [items] = Writer.map(coll.items, i => f.fn(() => i)).asTuple
			return vec(items)
		}
	),
	reduce: defn(
		'(-> (T U) [f: (-> [u:U t:T] U) coll: [...T] initial: U] U)',
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
	enum: defn('(-> [name:Str ...label:Str] _)', (name: Str, ...labels: Str[]) =>
		enumType(
			name.value,
			labels.map(l => l.value)
		)
	),
	fnType: defn('(-> [f:_] _)', (f: Value) => ('fnType' in f ? f.fnType : f)),
	isSubtype: defn('(-> [x:_ y:_] Bool)', (x: Value, y: Value) =>
		bool(x.isSubtypeOf(y))
	),
	show: defn('(-> [value:_] Str)', (value: Value) => str(value.print())),
	'++': defn('(-> [a:Str b:Str] Str)', (a: Str, b: Str) =>
		str(a.value + b.value)
	),
})

PreludeScope.defs(
	parseModule(`
<=: (=> [x:Num y:Num] (|| (== x y) (< x y)))
>: (=> [x:Num y:Num] (< y x))
>=: (=> [x:Num y:Num] (<= y x))

inc: (=> [x:Num] (+ x 1))
dec: (=> [x:Num] (- x 1))

isEven: (=> [x:Num] (== (% x 2) 0))

compose: (=> (T U V) [f:(-> [t:T] U) g:(-> [u:U] V)]
             (=> [x:T] (g (f x))))

const: (=> (T) [x:T] (=> [] x))

first: (=> (T) [coll:[...T]] (coll 0))

id: (=> (T) [x:T] x)

sqrt: (=> [x:Num] (if (<= 0 x)
											(** x 0.5)
											(log 0 "warn" "Negative number")))

square: (=> [x:Num] (** x 2))

hypot:  (=> [x:Num y:Num] (sqrt (+ (* x x) (* y y))))

PI: 3.1415926535897932384626433832795028841971693993
	`)
)

import {
	difference,
	differenceWith,
	entries,
	fromPairs,
	keys,
	mapValues,
	values,
} from 'lodash'

import {
	App,
	app,
	container,
	DictLiteral,
	dictLiteral,
	Expr,
	FnDef,
	fnDef,
	literal,
	paramsDef,
	PrintOptions,
	symbol,
	valueMeta,
	vecLiteral,
} from '../expr'
import {Log} from '../Log'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {createUniqueName} from '../util/NameCollision'
import {nullishEqual} from '../util/nullishEqual'
import {union} from '../util/SetOperation'
import {createFoldFn} from './fold'
import {unionType} from './TypeOperation'

export type Value = Type | Atomic

type Type = All | PrimType | EnumType | FnType | UnionType | TypeVar

export type Meta = Record<string, Value>

/**
 * Value that can be a default value. Non-type values
 */
type Atomic = Never | Unit | Prim<any> | Enum | Fn | Vec | Dict

const emptySet = new Set<any>()

const getTypeVars = createFoldFn<Set<TypeVar>>(
	{
		TypeVar: ty => new Set([ty]),
	},
	() => emptySet,
	union
)

export abstract class BaseValue {
	constructor() {
		return this
	}

	abstract readonly type: string

	abstract readonly superType: Value

	abstract readonly defaultValue: Value
	abstract readonly initialDefaultValue: Atomic

	#meta?: Meta
	get meta(): Meta | undefined {
		return this.#meta
	}
	set meta(meta: Meta | undefined) {
		if (meta) {
			if (values(meta).length === 0) return
			if ('default' in meta) {
				throw new Error('Meta cannot has a `default` field.')
			}
		}
		this.#meta = meta
	}

	abstract isEqualTo(value: Value): boolean

	isSubtypeOf(ty: Value): boolean {
		if (ty.type === 'UnionType') return ty.isSupertypeOf(this)
		return this.isEqualTo(ty) || this.superType.isSubtypeOf(ty)
	}

	abstract isType: boolean

	get typeVars(): Set<TypeVar> {
		return getTypeVars(this as any as Value)
	}

	/**
	 * その値が返された式への参照。Mutableであり、常にその値が返された最後の式への参照を持つ
	 */
	source?: Expr

	/**
	 * その値が、関数本体部の式において、仮引数のデフォルト値として返された値か?
	 */
	isParamDefault?: boolean

	log = new Set<Log>()

	withLog(...logs: Log[]): Value {
		const value = this.cloneOnlyProps()
		if (logs.length > 0) {
			value.log = union(this.log, logs)
		}
		return value
	}

	usesParamDefault() {
		const value = this.cloneOnlyProps()
		value.isParamDefault = true
		return value
	}

	protected abstract toExprExceptMeta(): Expr

	toExpr(): Expr {
		const expr = this.toExprExceptMeta()

		const hasDefaultValueChanged = !this.defaultValue.isEqualTo(
			this.initialDefaultValue
		)

		if (hasDefaultValueChanged || this.meta) {
			const defaultExpr = hasDefaultValueChanged
				? this.defaultValue.toExpr()
				: undefined

			const fields = mapValues(this.meta ?? {}, f => f.toExpr())

			if (defaultExpr) {
				fields['default'] = defaultExpr
			}

			return valueMeta(dictLiteral(fields), expr)
		} else {
			return expr
		}
	}

	// eslint-disable-next-line no-unused-vars
	withDefault(defaultValue: Atomic): Value {
		return this as any
	}

	withMeta(meta: Meta) {
		const thisMeta = this.meta ?? {}

		const value = this.cloneOnlyProps()
		value.meta = {...thisMeta, ...meta}
		return value
	}

	isTypeFor(value: Value): boolean {
		return !value.isType && value.isSubtypeOf(this as any)
	}

	print(options?: PrintOptions) {
		return this.toExpr().print(options)
	}

	clone() {
		const value = this.cloneOnlyProps()
		value.#meta = this.meta
		value.log = this.log
		value.isParamDefault = this.isParamDefault
		return value
	}

	protected abstract cloneOnlyProps(): Value
}

export type IFn = (...params: any[]) => Value

interface IFnType {
	fnType: FnType
}

interface IFnLike extends IFnType {
	fn: IFn
}

export class Unit extends BaseValue {
	get type() {
		return 'Unit' as const
	}

	get superType() {
		return All.instance
	}

	get defaultValue() {
		return this
	}

	get initialDefaultValue() {
		return this
	}

	isEqualTo(value: Value) {
		return this.type === value.type
	}

	isType = false

	protected toExprExceptMeta() {
		return app()
	}

	declare clone: () => Unit

	protected cloneOnlyProps() {
		return new Unit()
	}

	static instance = new Unit()
}

export const unit = Unit.instance

export class All extends BaseValue {
	get type() {
		return 'All' as const
	}

	private constructor() {
		super()
	}

	get superType() {
		return this
	}

	#defaultValue?: Atomic
	get defaultValue(): Atomic {
		return this.#defaultValue ?? Unit.instance
	}

	get initialDefaultValue() {
		return Unit.instance
	}

	// TODO: Resolve the name of symbol correctly
	protected toExprExceptMeta() {
		return symbol('_')
	}

	isEqualTo(value: Value) {
		return this.type === value.type
	}

	isSubtypeOf(value: Value) {
		return this.isEqualTo(value)
	}

	isType = true

	withDefault(defaultValue: Atomic): All {
		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	declare clone: () => All

	protected cloneOnlyProps() {
		const value = new All()
		value.#defaultValue = this.#defaultValue
		return value
	}

	static instance = new All()
}

export const all = All.instance

export class Never extends BaseValue {
	get type() {
		return 'Never' as const
	}

	private constructor() {
		super()
	}

	get superType() {
		return All.instance
	}

	get defaultValue() {
		return this
	}
	get initialDefaultValue() {
		return this
	}

	// TODO: Resolve the name of symbol correctly
	protected toExprExceptMeta() {
		return symbol('Never')
	}

	isEqualTo(value: Value) {
		return this.type === value.type
	}

	isSubtypeOf() {
		return true
	}

	isType = true

	declare clone: () => Never

	protected cloneOnlyProps() {
		return new Never()
	}

	static instance = new Never()
}

export const never = Never.instance

export class Prim<T = any> extends BaseValue {
	get type() {
		return 'Prim' as const
	}

	constructor(value: T, superType: PrimType<T>) {
		super()
		this.superType = superType
		this.value = value
	}

	readonly superType: PrimType<T>

	readonly value: T

	get defaultValue() {
		return this
	}
	get initialDefaultValue() {
		return this
	}

	protected toExprExceptMeta(): Expr {
		return this.superType.option.primToExpr(this)
	}

	isEqualTo(value: Value): boolean {
		return (
			this.type === value.type &&
			this.superType.isEqualTo(value.superType) &&
			this.superType.option.primEqual(this.value, value.value)
		)
	}

	isType = false

	declare clone: () => Prim<T>

	cloneOnlyProps(): Prim<T> {
		return new Prim<T>(this.value, this.superType)
	}
}

interface PrimTypeOption<T> {
	primToExpr: (prim: Prim<T>) => Expr
	primEqual: (a: T, b: T) => boolean
}

export class PrimType<T = any> extends BaseValue {
	get type() {
		return 'PrimType' as const
	}

	constructor(
		private readonly name: string,
		initialDefaultValue: T,
		public option: PrimTypeOption<T> = {
			primToExpr: container,
			primEqual: (a, b) => a === b,
		}
	) {
		super()

		this.#initialDefaultValue = new Prim(initialDefaultValue, this)

		return this
	}

	get superType() {
		return All.instance
	}

	#defaultValue?: Prim<T>
	get defaultValue(): Prim<T> {
		return (this.#defaultValue ??= this.#initialDefaultValue)
	}

	#initialDefaultValue: Prim<T>
	get initialDefaultValue(): Prim<T> {
		return this.#initialDefaultValue
	}

	// TODO: fix this
	protected toExprExceptMeta() {
		return symbol(this.name)
	}

	isEqualTo(value: Value) {
		return this.type === value.type && this.name === value.name
	}

	isType = true

	of(value: T): Prim<T> {
		return new Prim(value, this)
	}

	withDefault(defaultValue: Atomic): Value {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	declare clone: () => PrimType

	protected cloneOnlyProps() {
		const value = new PrimType<T>(
			this.name,
			this.#initialDefaultValue.value,
			this.option
		)

		value.#defaultValue = this.#defaultValue
		return value
	}

	isTypeFor(value: Value): value is Prim<T> {
		return value.type === 'Prim' && value.isSubtypeOf(this)
	}
}

export function primType<T>(
	name: string,
	initialDefaultValue: T,
	option?: PrimTypeOption<T>
) {
	return new PrimType(name, initialDefaultValue, option)
}

export type Number = Prim<number>
export type String = Prim<string>

export const NumberType = new PrimType('Number', 0, {
	primToExpr(prim) {
		return literal(prim.value)
	},
	primEqual(a, b) {
		return a === b || (isNaN(a) && isNaN(b))
	},
})

export const StringType = new PrimType('String', '', {
	primToExpr(prim) {
		return literal(prim.value)
	},
	primEqual: (a, b) => a === b,
})

export const number: (value: number) => Number = NumberType.of.bind(NumberType)
export const string: (value: string) => String = StringType.of.bind(StringType)

export class Enum extends BaseValue {
	get type() {
		return 'Enum' as const
	}

	constructor(public readonly name: string) {
		super()
	}

	superType!: EnumType

	get defaultValue() {
		return this
	}

	get initialDefaultValue() {
		return this
	}

	// TODO: fix this
	protected toExprExceptMeta() {
		return symbol(this.name)
	}

	isEqualTo(value: Value) {
		return (
			this.type === value.type &&
			this.name === value.name &&
			this.superType.isEqualTo(value.superType)
		)
	}

	isType = false

	declare clone: () => Enum

	protected cloneOnlyProps() {
		const value = new Enum(this.name)
		value.superType = this.superType
		return value
	}

	static of(name: string) {
		return new Enum(name)
	}
}

export class EnumType extends BaseValue {
	get type() {
		return 'EnumType' as const
	}

	public readonly name: string
	public readonly types: Enum[]

	constructor(name: string, labels: readonly string[]) {
		super()

		if (labels.length === 0) throw new Error('Zero-length enum')

		this.name = name
		this.types = labels.map(l => new Enum(l))
		this.types.forEach(t => (t.superType = this))
	}

	get superType() {
		return All.instance
	}

	#defaultValue?: Enum
	get defaultValue() {
		return this.#defaultValue ?? this.types[0]
	}

	get initialDefaultValue() {
		return this.types[0]
	}

	// TODO: fix this
	protected toExprExceptMeta() {
		return symbol(this.name)
	}

	isEqualTo(value: Value) {
		return this.type === value.type && this.name === value.name
	}

	isType = true

	getEnum(label: string) {
		const en = this.types.find(t => t.name === label)
		if (!en) throw new Error('Cannot find label')
		return en
	}

	isTypeFor(value: Value): value is Enum {
		return value.type === 'Enum' && value.isSubtypeOf(this)
	}

	withDefault(defaultValue: Atomic) {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.cloneOnlyProps()
		value.#defaultValue = defaultValue
		return value
	}

	cloneOnlyProps() {
		const value = new EnumType(
			this.name,
			this.types.map(t => t.name)
		)
		value.#defaultValue = this.#defaultValue
		return value
	}
}

export const enumType = (name: string, labels: readonly string[]) =>
	new EnumType(name, labels)

export const BooleanType = new EnumType('Boolean', ['false', 'true'])
export const True = BooleanType.getEnum('true')
export const False = BooleanType.getEnum('false')
export const boolean = (value: boolean) => (value ? True : False)

export class TypeVar extends BaseValue {
	#id = Symbol()

	get type() {
		return 'TypeVar' as const
	}
	readonly superType = All.instance

	public readonly name: string
	#original?: TypeVar

	constructor(name: string) {
		super()
		this.name = name
	}

	get defaultValue() {
		return Unit.instance
	}

	get initialDefaultValue() {
		return Unit.instance
	}

	protected toExprExceptMeta() {
		return symbol(this.name)
	}

	isEqualTo(value: Value) {
		return value.type === 'TypeVar' && this.#id === value.#id
	}

	isType = true

	declare clone: () => TypeVar

	protected cloneOnlyProps(): Value {
		const value = new TypeVar(this.name)
		value.#id = this.#id
		value.#original = this.#original
		return value
	}

	shadow(): TypeVar {
		const tv = new TypeVar(this.name)
		tv.#original = this
		return tv
	}

	unshadow(): TypeVar {
		return this.#original ?? this
	}
}

export const typeVar = (name: string) => new TypeVar(name)

export class Fn extends BaseValue implements IFnLike {
	get type() {
		return 'Fn' as const
	}

	constructor(
		public readonly superType: FnType,
		public readonly fn: IFn,
		public readonly body?: Expr
	) {
		super()
	}

	readonly fnType = this.superType

	get defaultValue() {
		return this
	}

	get initialDefaultValue() {
		return this
	}

	withLog!: (...logs: Log[]) => Fn
	usesParamDefault!: () => Fn

	isEqualTo(value: Value) {
		return this === value
	}

	isType = false

	protected toExprExceptMeta(): Expr {
		if (!this.body) {
			// It means the function is defined in JS natively
			return container(this)
		}

		const fnType = this.fnType

		const typeVars: string[] = []
		for (const tv of fnType.typeVars) {
			typeVars.push(createUniqueName(tv.name, typeVars))
		}

		const _params = mapValues(fnType.params, p => p.toExpr())
		const rest = fnType.rest
			? {name: fnType.rest.name ?? '', expr: fnType.rest.value.toExpr()}
			: undefined

		return fnDef(
			typeVars.length > 0 ? typeVars : null,
			paramsDef(_params, fnType.optionalPos, rest),
			fnType.ret.toExpr(),
			this.body.clone()
		)
	}

	declare clone: () => Fn

	protected cloneOnlyProps() {
		return new Fn(this.superType, this.fn, this.body)
	}
}

export const fn = (fnType: FnType, fnObj: IFn, body?: Expr) =>
	new Fn(fnType, fnObj, body)

export class FnType extends BaseValue implements IFnType {
	get type() {
		return 'FnType' as const
	}

	get superType() {
		return All.instance
	}

	public readonly params: Record<string, Value>
	public readonly optionalPos: number
	public readonly rest?: {name: string; value: Value}
	public readonly ret: Value

	constructor(params: FnType['params'], ret: Value)
	constructor(
		params: FnType['params'],
		optionalPos: number | null,
		rest: FnType['rest'],
		ret: Value
	)
	constructor(
		params: FnType['params'],
		retOrOptionalPos: number | Value | null,
		rest?: FnType['rest'],
		ret?: Value
	) {
		super()

		const maxRequiredParamNum = values(params).length

		const optionalPos =
			typeof retOrOptionalPos === 'number'
				? retOrOptionalPos
				: maxRequiredParamNum

		if (
			optionalPos < 0 ||
			maxRequiredParamNum < optionalPos ||
			optionalPos % 1 !== 0
		) {
			throw new Error('Invalid optionalPos: ' + optionalPos)
		}

		this.params = params
		this.optionalPos = optionalPos
		this.rest = rest

		if (retOrOptionalPos && typeof retOrOptionalPos !== 'number') {
			this.ret = retOrOptionalPos
		} else if (ret) {
			this.ret = ret
		} else {
			throw new Error('Invalid parameters for FnType constructor')
		}
	}

	get fnType() {
		return this
	}

	withLog!: (...logs: Log[]) => FnType
	usesParamDefault!: () => FnType

	#defaultValue?: Fn
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	#initialDefaultValue?: Fn
	get initialDefaultValue(): Fn {
		if (!this.#initialDefaultValue) {
			const fnObj = () => this.ret.defaultValue
			const fn = new Fn(this, fnObj, this.ret.defaultValue.toExpr())
			this.#initialDefaultValue = fn
		}
		return this.#initialDefaultValue
	}

	protected toExprExceptMeta(): FnDef {
		// Collect all type varaibles
		const typeVars: string[] = []

		for (const tv of this.typeVars) {
			typeVars.push(createUniqueName(tv.name, typeVars))
		}

		// その他もろもろ
		const params = mapValues(this.params, p => p.toExpr())

		const rest = this.rest
			? {name: this.rest.name, expr: this.rest.value.toExpr()}
			: undefined

		return fnDef(
			typeVars.length > 0 ? typeVars : null,
			paramsDef(params, this.optionalPos, rest),
			this.ret.toExpr(),
			null
		)
	}

	isEqualTo(value: Value): boolean {
		if (this.type !== value.type) return false

		if (!isEqualArray(values(this.params), values(value.params), isEqual)) {
			return false
		}

		if (this.optionalPos !== value.optionalPos) return false

		if (
			!nullishEqual(
				this.rest,
				value.rest,
				(a, b) => a.name === b.name && a.value.isEqualTo(b.value)
			)
		) {
			return false
		}

		return this.ret.isEqualTo(value.ret)
	}

	isSubtypeOf(value: Value): boolean {
		if (this.superType.isSubtypeOf(value)) return true
		if (value.type === 'UnionType') return value.isSupertypeOf(this)
		if (value.type !== 'FnType') return false

		const thisParam = new Vec(
			values(this.params),
			this.optionalPos,
			this.rest?.value
		)
		const valueParam = new Vec(
			values(value.params),
			value.optionalPos,
			value.rest?.value
		)

		return valueParam.isSubtypeOf(thisParam) && this.ret.isSubtypeOf(value.ret)
	}

	isType = true

	declare isTypeFor: (value: Value) => value is Fn

	withDefault(defaultValue: Atomic): Value {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.cloneOnlyProps()
		value.#defaultValue = defaultValue
		return value
	}

	declare clone: () => FnType

	protected cloneOnlyProps() {
		const value = new FnType(this.params, this.optionalPos, this.rest, this.ret)
		value.#defaultValue = this.#defaultValue
		value.#initialDefaultValue = this.#initialDefaultValue
		return value
	}
}

interface IFnTypeConstructor {
	(params: FnType['params'], ret: Value): FnType
	(
		params: FnType['params'],
		optionalPos: number | null,
		rest: FnType['rest'],
		ret: Value
	): FnType
	(
		params: FnType['params'],
		retOrOptionalPos: number | Value | null,
		rest?: FnType['rest'],
		ret?: Value
	): FnType
}

export const fnType: IFnTypeConstructor = (
	params,
	retOrOptionalPos,
	rest?,
	ret?
) => new FnType(params, retOrOptionalPos as any, rest as any, ret as any)

export class Vec<V extends Value = Value> extends BaseValue implements IFnLike {
	get type() {
		return 'Vec' as const
	}

	get superType() {
		return All.instance
	}

	public readonly items: readonly V[]
	public readonly optionalPos: number
	public readonly rest?: Value

	constructor(items?: readonly V[], optionalPos?: number, rest?: Value) {
		super()

		items ??= []

		optionalPos ??= items.length

		if (
			optionalPos < 0 ||
			items.length < optionalPos ||
			optionalPos % 1 !== 0
		) {
			throw new Error('Invalid optionalPos: ' + optionalPos)
		}

		this.items = items ?? []
		this.optionalPos = optionalPos
		this.rest = rest
	}

	#defaultValue?: Vec
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	#initialDefaultValue?: Vec
	get initialDefaultValue(): Vec {
		if (!this.#initialDefaultValue) {
			const items = this.items
				.slice(0, this.optionalPos)
				.map(it => it.defaultValue)

			this.#initialDefaultValue = new Vec(items)
		}
		return this.#initialDefaultValue
	}

	protected toExprExceptMeta(): Expr {
		const items = this.items.map(it => it.toExpr())
		return vecLiteral(items, this.optionalPos, this.rest?.toExpr())
	}

	isEqualTo(value: Value) {
		return (
			this.type === value.type &&
			isEqualArray(this.items, value.items, isEqual) &&
			this.optionalPos === value.optionalPos &&
			nullishEqual(this.rest, value.rest, isEqual)
		)
	}

	private *asIterator(): Generator<Value, void, boolean> {
		for (const it of this.items) {
			yield it
		}
		if (!this.rest) return
		while (true) {
			const endsWithRest: boolean = yield this.rest
			if (endsWithRest) return
		}
	}

	isSubtypeOf(value: Value): boolean {
		if (this.superType.isSubtypeOf(value)) return true
		if (value.type === 'UnionType') return value.isSupertypeOf(this)
		if (value.type !== 'Vec') return false

		if (this.optionalPos < value.optionalPos) return false

		const tIter = this.asIterator()

		let i = 0
		for (const vi of value.items) {
			const ti = tIter.next().value
			if (!ti && value.optionalPos <= i++) break
			if (!ti || !ti.isSubtypeOf(vi)) return false
		}

		if (value.rest) {
			for (let ti; (ti = tIter.next(true).value); ) {
				if (!ti.isSubtypeOf(value.rest)) return false
			}
		}

		return true
	}

	get isType(): boolean {
		return (
			this.optionalPos < this.items.length ||
			!!this.rest ||
			this.items.map(it => it.isType).includes(true)
		)
	}

	get fnType() {
		return new FnType({index: NumberType}, unionType(...this.items))
	}

	#fn(index: Value) {
		if (this.items.length === 0) {
			throw new Error('Cannot refer any element of empty vector')
		}

		let i = Math.floor((index as Number).value)

		if (i < 0 || this.items.length <= i) {
			i = Math.max(0, Math.min(i, this.items.length - 1))

			return this.items[i].withLog({
				level: 'warn',
				reason: 'Index out of range',
			})
		}

		return this.items[i]
	}

	get fn(): IFn {
		return this.#fn
	}

	declare isTypeFor: (value: Value) => value is Vec

	withDefault(defaultValue: Atomic): Value {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	declare clone: () => Vec

	protected cloneOnlyProps(): Vec {
		const value = new Vec(this.items, this.optionalPos, this.rest)
		value.#defaultValue = this.#defaultValue
		return value
	}
}

export const vec = <V extends Value = Value>(
	items?: V[],
	optionalPos?: number,
	rest?: Value
) => new Vec(items, optionalPos, rest)

export class Dict<
	TItems extends Record<string, Value> = Record<string, Value>
> extends BaseValue {
	get type() {
		return 'Dict' as const
	}

	constructor(
		public readonly items: TItems,
		public readonly optionalKeys: Set<string>,
		public readonly rest?: Value
	) {
		super()
	}

	get superType() {
		return All.instance
	}

	#isRequredKey(key: string) {
		return key in this.items && !this.optionalKeys.has(key)
	}

	#defaultValue?: Dict
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	get initialDefaultValue(): Dict {
		const itemEntries = entries(this.items)
			.filter(([k]) => this.#isRequredKey(k))
			.map(([k, v]) => [k, v.defaultValue])

		return Dict.of(fromPairs(itemEntries))
	}

	protected toExprExceptMeta(): DictLiteral {
		const items = mapValues(this.items, it => it.toExpr())
		return dictLiteral(items, this.optionalKeys, this.rest?.toExpr())
	}

	declare toExpr: () => DictLiteral

	isEqualTo(value: Value) {
		return (
			this.type === value.type &&
			isEqualDict(this.items, value.items, isEqual) &&
			isEqualSet(this.optionalKeys, value.optionalKeys) &&
			nullishEqual(this.rest, value.rest, isEqual)
		)
	}

	isSubtypeOf(value: Value): boolean {
		if (this.superType.isSubtypeOf(value)) return true
		if (value.type === 'UnionType') return value.isSupertypeOf(this)
		if (value.type !== 'Dict') return false

		const tKeys = keys(value.items)

		for (const k of tKeys) {
			const vi = value.items[k]
			if (value.#isRequredKey(k)) {
				const sv = this.#isRequredKey(k) ? this.items[k] : false
				if (!sv || !sv.isSubtypeOf(vi)) return false
			} else {
				const sv = k in this.items ? this.items[k] : this.rest
				if (sv && !sv.isSubtypeOf(vi)) return false
			}
		}

		if (value.rest) {
			const sKeys = keys(this.items)
			const extraKeys = difference(sKeys, tKeys)
			for (const k of extraKeys) {
				if (!this.items[k].isSubtypeOf(value.rest)) return false
			}
			if (this.rest && !this.rest.isSubtypeOf(value.rest)) return false
		}

		return true
	}

	get isType(): boolean {
		return (
			this.optionalKeys.size > 0 ||
			!!this.rest ||
			values(this.items)
				.map(it => it.isType)
				.includes(true)
		)
	}

	declare isTypeFor: (value: Value) => value is Dict

	withDefault(defaultValue: Atomic): Value {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	declare clone: () => Dict

	protected cloneOnlyProps(): Dict<TItems> {
		const value = new Dict(this.items, this.optionalKeys, this.rest)
		value.#defaultValue = this.#defaultValue
		return value
	}

	static of<TItems extends Record<string, Value>>(
		items: TItems,
		optionalKeys: Iterable<string> = [],
		rest?: Value
	) {
		return new Dict<TItems>(items, new Set(optionalKeys), rest)
	}
}

export const dict = Dict.of

export class UnionType extends BaseValue {
	get type() {
		return 'UnionType' as const
	}

	get superType() {
		return All.instance
	}

	constructor(public types: readonly Value[]) {
		super()
		if (types.length < 2) throw new Error('Too few types to create union type')
	}

	#defaultValue!: Atomic
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	get initialDefaultValue(): Atomic {
		return this.types[0].defaultValue
	}

	protected toExprExceptMeta(): App {
		const types = this.types.map(ty => ty.toExpr())
		return app(symbol('union'), ...types)
	}

	isEqualTo(value: Value): boolean {
		return (
			this.type === value.type &&
			differenceWith(this.types, value.types, isEqual).length === 0
		)
	}

	isSubtypeOf(type: Value): boolean {
		if (this.superType.isSubtypeOf(type)) return true

		const types: UnionType['types'] =
			type.type === 'UnionType' ? type.types : [type]
		return this.types.every(s => types.some(s.isSubtypeOf.bind(s)))
	}

	isSupertypeOf(s: Pick<Value, 'isSubtypeOf'>) {
		return this.types.some(s.isSubtypeOf.bind(s))
	}

	isType = true

	declare clone: () => UnionType

	withDefault(defaultValue: Atomic): Value {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	protected cloneOnlyProps() {
		const value = new UnionType(this.types)
		value.#defaultValue = this.#defaultValue
		return value
	}

	/**
	 * Creates an union type as it is with no type overwrapping detection.
	 */
	static fromTypesUnsafe(types: readonly Value[]) {
		return new UnionType(types)
	}

	static of = unionType
}

export function isEqual(a: Value, b: Value): boolean {
	return a.isEqualTo(b)
}

export function isSubtype(a: Value, b: Value): boolean {
	return a.isSubtypeOf(b)
}

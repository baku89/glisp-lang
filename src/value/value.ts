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
	Arg,
	DictLiteral,
	dictLiteral,
	Expr,
	FnDef,
	fnDef,
	literal,
	paramsDef,
	PrintOptions,
	symbol,
	valueContainer,
	valueMeta,
	vecLiteral,
} from '../expr'
import {getTypeVars} from '../expr/unify'
import {WithLog, withLog} from '../log'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {createUniqueName} from '../util/NameCollision'
import {nullishEqual} from '../util/nullishEqual'
import {union} from '../util/SetOperation'
import {unionType} from './TypeOperation'
import {createFoldFn} from './walk'

export type Value = Type | Atomic

type Type = All | PrimType | EnumType | FnType | UnionType | TypeVar

/**
 * Value that can be a default value. Non-type values
 */
type Atomic =
	| Never
	| Unit
	| Prim<any>
	| Number
	| String
	| Enum
	| Fn
	| Vec
	| Dict

abstract class BaseValue {
	constructor() {
		return this
	}

	abstract readonly type: string

	abstract readonly superType: Value

	abstract readonly defaultValue: Value
	abstract readonly initialDefaultValue: Atomic

	meta?: Dict

	abstract isEqualTo(value: Value): boolean

	isSubtypeOf = (ty: Value): boolean => {
		if (ty.type === 'UnionType') return ty.isSupertypeOf(this)
		return this.isEqualTo(ty) || this.superType.isSubtypeOf(ty)
	}

	get isType(): boolean {
		return isType(this as any)
	}

	protected abstract toExprExceptMeta(): Expr

	toExpr = (): Expr => {
		const expr = this.toExprExceptMeta()

		const hasDefaultValueChanged = !this.defaultValue.isEqualTo(
			this.initialDefaultValue
		)

		if (hasDefaultValueChanged || this.meta) {
			const defaultValue = hasDefaultValueChanged
				? this.defaultValue.toExpr()
				: undefined

			let metaItems = {...(this.meta?.toExpr().items ?? {})}

			if (defaultValue) {
				delete metaItems.default
				metaItems = {default: defaultValue, ...metaItems}
			}

			return valueMeta(dictLiteral(metaItems), expr)
		} else {
			return expr
		}
	}

	// eslint-disable-next-line no-unused-vars
	withDefault = (defaultValue: Atomic): Value => this as any

	withMeta = (meta: Dict) => {
		const thisMetaItems = this.meta?.items ?? {}

		const value = this.clone()
		value.meta = Dict.of({...thisMetaItems, ...meta.items})
		return value
	}

	isTypeFor = (value: Value): boolean => {
		return !value.isType && value.isSubtypeOf(this as any)
	}

	print = (options?: PrintOptions) => this.toExpr().print(options)

	abstract clone(): Value
}

export type IFn = (...params: Arg<any>[]) => WithLog

interface IFnType {
	fnType: FnType
}

interface IFnLike extends IFnType {
	fn: IFn
}

export class Unit extends BaseValue {
	readonly type = 'Unit' as const

	readonly superType!: All

	readonly defaultValue = this
	readonly initialDefaultValue = this

	isEqualTo = (value: Value) => this.type === value.type

	protected toExprExceptMeta = () => app()

	clone = () => {
		const value = new Unit()
		value.meta = this.meta
		return value
	}

	static instance = new Unit()
}

export class All extends BaseValue {
	readonly type = 'All' as const

	private constructor() {
		super()
	}

	readonly superType = this

	#defaultValue?: Atomic
	get defaultValue() {
		return (this.#defaultValue ??= Unit.instance)
	}

	readonly initialDefaultValue = Unit.instance

	// TODO: Resolve the name of symbol correctly
	protected toExprExceptMeta = () => symbol('_')

	isEqualTo = (value: Value) => this.type === value.type

	isSubtypeOf = this.isEqualTo

	withDefault = (defaultValue: Atomic): Value => {
		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new All()
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}

	static instance = new All()
}

;(Unit.prototype.superType as Unit['superType']) = All.instance

export class Never extends BaseValue {
	readonly type = 'Never' as const

	private constructor() {
		super()
	}

	readonly superType = All.instance

	readonly defaultValue = this
	readonly initialDefaultValue = this

	// TODO: Resolve the name of symbol correctly
	protected toExprExceptMeta = () => symbol('Never')

	isEqualTo = (value: Value) => this.type === value.type

	isSubtypeOf = () => true

	clone = () => {
		const value = new Never()
		value.meta = this.meta
		return value
	}

	static instance = new Never()
}

export class Prim<T = any> extends BaseValue {
	readonly type = 'Prim' as const

	public readonly superType!: PrimType
	public readonly value: T

	constructor(superType: PrimType, value: T) {
		super()
		if (superType !== undefined) {
			this.superType = superType
		}
		this.value = value
	}

	readonly defaultValue = this
	readonly initialDefaultValue = this

	protected toExprExceptMeta = (): Expr => valueContainer(this)

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		this.value === value.value &&
		this.superType.isEqualTo(value.superType)

	clone = () => {
		const value = new Prim(this.superType, this.value)
		value.meta = this.meta
		return value
	}
}

export class Number extends Prim<number> {
	protected toExprExceptMeta = () => literal(this.value)

	constructor(value: number) {
		super(undefined as any, value)
	}
}

export class String extends Prim<string> {
	protected toExprExceptMeta = () => literal(this.value)

	constructor(value: string) {
		super(undefined as any, value)
	}

	toString() {
		return this.value
	}
}

export class PrimType<T = any> extends BaseValue {
	readonly type = 'PrimType' as const

	constructor(private readonly name: string, initialDefaultValue: T) {
		super()

		if (
			initialDefaultValue instanceof Number ||
			initialDefaultValue instanceof String
		) {
			this.#initialDefaultValue = initialDefaultValue
		} else {
			this.#initialDefaultValue = new Prim(this, initialDefaultValue)
		}

		return this
	}

	readonly superType = All.instance

	#defaultValue?: Number | String | Prim
	get defaultValue() {
		return (this.#defaultValue ??= this.#initialDefaultValue)
	}

	#initialDefaultValue!: Number | String | Prim
	get initialDefaultValue() {
		return this.#initialDefaultValue
	}

	// TODO: fix this
	protected toExprExceptMeta = () => symbol(this.name)

	isEqualTo = (value: Value) =>
		this.type === value.type && this.name === value.name

	of(value: T): Prim<T> {
		return new Prim(this, value)
	}

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new PrimType(this.name, this.#initialDefaultValue)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}

	isTypeFor = (value: Value): value is Prim<T> =>
		value.type === 'Prim' && value.isSubtypeOf(this)
}

export const NumberType = new PrimType('Number', new Number(0))
;(Number.prototype.superType as Number['superType']) = NumberType

export const StringType = new PrimType('String', new String(''))
;(String.prototype.superType as String['superType']) = StringType

export class Enum extends BaseValue {
	readonly type = 'Enum' as const

	constructor(public readonly name: string) {
		super()
	}

	readonly superType!: EnumType

	readonly defaultValue = this
	readonly initialDefaultValue = this

	// TODO: fix this
	protected toExprExceptMeta = () => symbol(this.name)

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		this.name === value.name &&
		this.superType.isEqualTo(value.superType)

	clone = () => {
		const value = new Enum(this.name)
		value.meta = this.meta
		return value
	}

	static of(name: string) {
		return new Enum(name)
	}
}

export class EnumType extends BaseValue {
	readonly type = 'EnumType' as const

	public readonly name: string
	public readonly types: Enum[]

	constructor(name: string, labels: string[]) {
		super()

		if (labels.length === 0) throw new Error('Zero-length enum')

		this.name = name
		this.types = labels.map(l => new Enum(l))
		this.types.forEach(t => ((t.superType as EnumType) = this))
	}

	readonly superType = All.instance

	#defaultValue?: Enum
	get defaultValue() {
		return this.#defaultValue ?? this.types[0]
	}

	get initialDefaultValue() {
		return this.types[0]
	}

	// TODO: fix this
	protected toExprExceptMeta = () => symbol(this.name)

	isEqualTo = (value: Value) =>
		this.type === value.type && this.name === value.name

	getEnum = (label: string) => {
		const en = this.types.find(t => t.name === label)
		if (!en) throw new Error('Cannot find label')
		return en
	}

	isTypeFor = (value: Value): value is Enum =>
		value.type === 'Enum' && value.isSubtypeOf(this)

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new EnumType(
			this.name,
			this.types.map(t => t.name)
		)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}
}

export class TypeVar extends BaseValue {
	readonly type = 'TypeVar' as const
	readonly superType = All.instance

	public readonly name: string
	public readonly original?: TypeVar

	constructor(name: string) {
		super()
		this.name = name
	}

	readonly defaultValue = Unit.instance
	readonly initialDefaultValue = Unit.instance

	protected toExprExceptMeta = () => symbol(this.name)

	isEqualTo = (value: Value) => this === value

	clone = () => {
		throw new Error('TypeVar cannot be cloned')
	}

	shadow = (): TypeVar => {
		const tv = new TypeVar(this.name)
		;(tv.original as TypeVar) = this
		return tv
	}

	unshadow = (): TypeVar => {
		return this.original ?? this
	}
}

export class Fn extends BaseValue implements IFnLike {
	readonly type = 'Fn' as const

	constructor(
		public readonly superType: FnType,
		public readonly fn: IFn,
		public readonly body?: Expr
	) {
		super()
	}

	readonly fnType = this.superType

	readonly defaultValue = this
	readonly initialDefaultValue = this

	isEqualTo = (value: Value) => this === value

	protected toExprExceptMeta = (): Expr => {
		if (!this.body) {
			// It means the function is defined in JS natively
			return valueContainer(this)
		}

		const {fnType} = this

		const typeVars: string[] = []
		for (const tv of getTypeVars(fnType)) {
			typeVars.push(createUniqueName(tv.name, typeVars))
		}

		const _params = mapValues(fnType.params, p => p.toExpr())
		const rest = fnType.rest
			? {name: fnType.rest.name ?? '', expr: fnType.rest.value.toExpr()}
			: undefined

		return fnDef(
			typeVars.length > 0 ? typeVars : null,
			paramsDef(_params, fnType.optionalPos, rest),
			fnType.out.toExpr(),
			this.body.clone()
		)
	}

	clone = () => {
		const value = new Fn(this.superType, this.fn, this.body)
		value.meta = this.meta
		return value
	}
}

export class FnType extends BaseValue implements IFnType {
	readonly type = 'FnType' as const
	readonly superType = All.instance

	public readonly params: Record<string, Value>
	public readonly optionalPos: number
	public readonly rest?: {name: string; value: Value}
	public readonly out: Value

	constructor(params: FnType['params'], out: Value)
	constructor(
		params: FnType['params'],
		optionalPos: number | null,
		rest: FnType['rest'],
		out: Value
	)
	constructor(
		params: FnType['params'],
		outOrOptionalPos: number | Value | null,
		rest?: FnType['rest'],
		out?: Value
	) {
		super()

		const maxRequiredParamNum = values(params).length

		const optionalPos =
			typeof outOrOptionalPos === 'number'
				? outOrOptionalPos
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

		if (outOrOptionalPos && typeof outOrOptionalPos !== 'number') {
			this.out = outOrOptionalPos
		} else if (out) {
			this.out = out
		} else {
			throw new Error('Invalid parameters for FnType constructor')
		}
	}

	readonly fnType = this

	#defaultValue?: Fn
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	#initialDefaultValue?: Fn
	get initialDefaultValue(): Fn {
		if (!this.#initialDefaultValue) {
			const fnObj = () => withLog(this.out.defaultValue)
			const fn = new Fn(this, fnObj)
			this.#initialDefaultValue = fn
		}
		return this.#initialDefaultValue
	}

	#typeVars?: Set<TypeVar>
	get typeVars() {
		if (!this.#typeVars) {
			const tvParams = union(
				...values(this.params).map(getTypeVars),
				this.rest ? getTypeVars(this.rest.value) : new Set()
			)

			const tvOut = getTypeVars(this.out)

			this.#typeVars = union(tvParams, tvOut)
		}
		return this.#typeVars
	}

	protected toExprExceptMeta = (): FnDef => {
		// Collect all type varaibles
		const typeVars: string[] = []

		for (const tv of getTypeVars(this)) {
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
			this.out.toExpr(),
			null
		)
	}

	isEqualTo = (value: Value): boolean =>
		this.type === value.type &&
		isEqualArray(values(this.params), values(value.params), isEqual) &&
		this.optionalPos === value.optionalPos &&
		nullishEqual(
			this.rest,
			value.rest,
			(a, b) => a.name === b.name && a.value.isEqualTo(b.value)
		) &&
		this.out.isEqualTo(value.out)

	isSubtypeOf = (value: Value): boolean => {
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

		return valueParam.isSubtypeOf(thisParam) && this.out.isSubtypeOf(value.out)
	}

	declare isTypeFor: (value: Value) => value is Fn

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new FnType(this.params, this.optionalPos, this.rest, this.out)
		value.#defaultValue = this.#defaultValue
		value.#initialDefaultValue = this.#initialDefaultValue
		value.#typeVars = this.#typeVars
		value.meta = this.meta
		return value
	}
}

export class Vec<V extends Value = Value> extends BaseValue implements IFnLike {
	readonly type = 'Vec' as const
	readonly superType = All.instance

	public readonly items: V[]
	public readonly optionalPos: number
	public readonly rest?: Value

	constructor(items?: V[], optionalPos?: number, rest?: Value) {
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

	protected toExprExceptMeta = (): Expr => {
		const items = this.items.map(it => it.toExpr())
		return vecLiteral(items, this.optionalPos, this.rest?.toExpr())
	}

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		isEqualArray(this.items, value.items, isEqual) &&
		this.optionalPos === value.optionalPos &&
		nullishEqual(this.rest, value.rest, isEqual)

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

	isSubtypeOf = (value: Value): boolean => {
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

	get fnType() {
		return new FnType({index: NumberType}, unionType(...this.items))
	}

	get fn(): IFn {
		return (index: Arg<Number>) => {
			const ret = this.items[index().value]
			if (ret === undefined) {
				throw new Error('Index out of range')
			}
			return withLog(ret)
		}
	}

	declare isTypeFor: (value: Value) => value is Vec

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = (): Vec => {
		const value = new Vec(this.items, this.optionalPos, this.rest)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}
}

export class Dict<
	TItems extends Record<string, Value> = Record<string, Value>
> extends BaseValue {
	readonly type = 'Dict' as const

	constructor(
		public readonly items: TItems,
		public readonly optionalKeys: Set<string>,
		public readonly rest?: Value
	) {
		super()
	}

	readonly superType = All.instance

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

	protected toExprExceptMeta = (): DictLiteral => {
		const items = mapValues(this.items, it => it.toExpr())
		return dictLiteral(items, this.optionalKeys, this.rest?.toExpr())
	}

	declare toExpr: () => DictLiteral

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		isEqualDict(this.items, value.items, isEqual) &&
		isEqualSet(this.optionalKeys, value.optionalKeys) &&
		nullishEqual(this.rest, value.rest, isEqual)

	isSubtypeOf = (value: Value): boolean => {
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

	declare isTypeFor: (value: Value) => value is Dict

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = (): Dict<TItems> => {
		const value = new Dict(this.items, this.optionalKeys, this.rest)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
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

export class UnionType extends BaseValue {
	readonly type = 'UnionType' as const
	superType = All.instance

	constructor(public types: Value[]) {
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

	protected toExprExceptMeta = (): App => {
		const types = this.types.map(ty => ty.toExpr())
		return app(symbol('union'), ...types)
	}

	isEqualTo = (value: Value): boolean =>
		this.type === value.type &&
		differenceWith(this.types, value.types, isEqual).length === 0

	isSubtypeOf = (type: Value): boolean => {
		if (this.superType.isSubtypeOf(type)) return true

		const types: Value[] = type.type === 'UnionType' ? type.types : [type]
		return this.types.every(s => types.some(s.isSubtypeOf))
	}

	isSupertypeOf = (s: Pick<Value, 'isSubtypeOf'>) =>
		this.types.some(s.isSubtypeOf)

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new UnionType(this.types)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}

	/**
	 * Creates an union type as it is with no type overwrapping detection.
	 */
	static fromTypesUnsafe(types: Value[]) {
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

const or = (...xs: boolean[]) => xs.some(x => x)

const isType = createFoldFn(
	{
		TypeVar: () => true,
		Never: () => true,
		PrimType: () => true,
		EnumType: () => true,
		FnType: () => true,
		UnionType: () => true,

		Fn: () => false,

		Vec(v, fold, c) {
			return fold(...v.items.map(c), v.optionalPos < v.items.length, !!v.rest)
		},
		Dict(v, fold, c) {
			return fold(...values(v.items).map(c), v.optionalKeys.size > 0, !!v.rest)
		},
	},
	false,
	or
)

import {
	difference,
	differenceWith,
	entries,
	fromPairs,
	keys,
	mapValues,
	values,
} from 'lodash'

import * as Ast from '../ast'
import type {PrintOptions} from '../ast/ast'
import {getTypeVars} from '../ast/unify'
import {Log, withLog} from '../log'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {nullishEqual} from '../util/nullishEqual'
import {Writer} from '../util/Writer'
import {unionType} from './TypeOperation'
import {createFoldFn} from './walk'

export type Value = Type | Atomic

type Type = All | PrimType | EnumType | FnType | UnionType | TypeVar

// Value that can be a default value
type Atomic = Never | Unit | Prim<any> | Num | Str | Enum | Fn | Vec | Dict

export type UnitableType = Exclude<Value, All | Never>

abstract class BaseValue {
	protected constructor() {
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

	protected abstract toAstExceptMeta(): Ast.Node

	toAst = (): Ast.Node => {
		const node = this.toAstExceptMeta()

		const hasDefaultValueChanged = !isEqual(
			this.defaultValue,
			this.initialDefaultValue
		)

		if (hasDefaultValueChanged || this.meta) {
			const defaultValue = hasDefaultValueChanged
				? this.defaultValue.toAst()
				: undefined

			let metaItems = {...(this.meta?.toAst().items ?? {})}

			if (defaultValue) {
				delete metaItems.default
				metaItems = {default: defaultValue, ...metaItems}
			}

			return Ast.valueMeta(Ast.dict(metaItems), node)
		} else {
			return node
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

	print = (options?: PrintOptions) => this.toAst().print(options)

	abstract clone(): Value
}

export type IFn = (...params: Ast.Arg<any>[]) => Writer<Value, Omit<Log, 'ref'>>

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

	protected toAstExceptMeta = () => Ast.app()

	clone = () => {
		const value = new Unit()
		value.meta = this.meta
		return value
	}

	static instance = new Unit()
}

export class All extends BaseValue {
	readonly type = 'All' as const

	readonly superType = this

	#defaultValue?: Atomic
	get defaultValue() {
		return (this.#defaultValue ??= Unit.instance)
	}

	readonly initialDefaultValue = Unit.instance

	// TODO: Resolve the name of symbol correctly
	protected toAstExceptMeta = () => Ast.id('_')

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

	readonly superType = All.instance

	readonly defaultValue = this
	readonly initialDefaultValue = this

	// TODO: Resolve the name of symbol correctly
	protected toAstExceptMeta = () => Ast.id('Never')

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

	protected constructor(
		public readonly superType: PrimType,
		public readonly value: T
	) {
		super()
	}

	readonly defaultValue = this
	readonly initialDefaultValue = this

	protected toAstExceptMeta = (): Ast.Node => Ast.value(this)

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		this.value === value.value &&
		isEqual(this.superType, value.superType)

	clone = () => {
		const value = new Prim(this.superType, this.value)
		value.meta = this.meta
		return value
	}

	static from<T>(ty: PrimType, value: T) {
		return new Prim<T>(ty, value)
	}
}

export class Num extends Prim<number> {
	protected toAstExceptMeta = () => Ast.num(this.value)

	static of(value: number) {
		return new Num(NumType, value)
	}
}

export class Str extends Prim<string> {
	protected toAstExceptMeta = () => Ast.str(this.value)

	static of(value: string) {
		return new Str(StrType, value)
	}
}

export class PrimType<T = any> extends BaseValue {
	readonly type = 'PrimType' as const

	private constructor(private readonly name: string) {
		super()
	}

	readonly superType = All.instance

	#defaultValue!: Num | Str | Prim
	get defaultValue() {
		return (this.#defaultValue ??= this.#initialDefaultValue)
	}

	#initialDefaultValue!: Num | Str | Prim
	get initialDefaultValue() {
		return this.#initialDefaultValue
	}

	// TODO: fix this
	protected toAstExceptMeta = () => Ast.id(this.name)

	isEqualTo = (value: Value) =>
		this.type === value.type && this.name === value.name

	of(value: T): Prim<T> {
		return Prim.from(this, value)
	}

	withDefault = (defaultValue: Atomic): Value => {
		if (!this.isTypeFor(defaultValue)) throw new Error('Invalid default value')

		const value = this.clone()
		value.#defaultValue = defaultValue
		return value
	}

	clone = () => {
		const value = new PrimType(this.name)
		value.#defaultValue = this.defaultValue
		value.#initialDefaultValue = this.#initialDefaultValue
		value.meta = this.meta
		return value
	}

	isTypeFor = (value: Value): value is Prim<T> =>
		value.type === 'Prim' && value.isSubtypeOf(this)

	static ofLiteral(name: string, defaultValue: Prim) {
		const primType = new PrimType(name)

		primType.#defaultValue = primType.#initialDefaultValue = defaultValue
		;(defaultValue.superType as Prim['superType']) = primType

		return primType
	}

	static of<T>(name: string, defaultValue: T) {
		const primType = new PrimType<T>(name)
		const d = Prim.from(primType, defaultValue)

		primType.#defaultValue = primType.#initialDefaultValue = d

		return primType
	}
}

export const NumType = PrimType.ofLiteral('Num', Num.of(0))
;(Num.prototype.superType as Num['superType']) = NumType

export const StrType = PrimType.ofLiteral('Str', Str.of(''))
;(Str.prototype.superType as Str['superType']) = StrType

export class Enum extends BaseValue {
	readonly type = 'Enum' as const

	private constructor(public readonly name: string) {
		super()
	}

	readonly superType!: EnumType

	readonly defaultValue = this
	readonly initialDefaultValue = this

	// TODO: fix this
	protected toAstExceptMeta = () => Ast.id(this.name)

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

	private constructor(
		public readonly name: string,
		public readonly types: Enum[]
	) {
		super()
	}

	readonly superType = All.instance

	#defaultValue?: Enum
	get defaultValue() {
		return (this.#defaultValue ??= this.types[0])
	}

	readonly initialDefaultValue = this.types[0]

	// TODO: fix this
	protected toAstExceptMeta = () => Ast.id(this.name)

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
		const value = new EnumType(this.name, this.types)
		value.#defaultValue = this.#defaultValue
		value.meta = this.meta
		return value
	}

	static of(name: string, labels: string[]) {
		if (labels.length === 0) throw new Error('Zero-length enum')

		const types = labels.map(Enum.of)
		const enumType = new EnumType(name, types)
		types.forEach(t => ((t.superType as Enum['superType']) = enumType))

		return enumType
	}
}

export class TypeVar extends BaseValue {
	readonly type = 'TypeVar' as const
	readonly superType = All.instance

	private constructor(
		public readonly name: string,
		public readonly original?: TypeVar
	) {
		super()
	}

	readonly defaultValue = Unit.instance
	readonly initialDefaultValue = Unit.instance

	protected toAstExceptMeta = () => Ast.id(this.name)

	isEqualTo = (value: Value) => this === value

	clone = () => {
		throw new Error('TypeVar cannot be cloned')
	}

	shadow = (): TypeVar => {
		return new TypeVar(this.name, this)
	}

	unshadow = (): TypeVar => {
		return this.original ?? this
	}

	public static of(name: string) {
		return new TypeVar(name)
	}
}

export class Fn extends BaseValue implements IFnLike {
	readonly type = 'Fn' as const

	private constructor(
		public readonly superType: FnType,
		public readonly fn: IFn,
		public readonly body?: Ast.Node
	) {
		super()
	}

	readonly fnType = this.superType

	readonly defaultValue = this
	readonly initialDefaultValue = this

	isEqualTo = (value: Value) => this === value

	protected toAstExceptMeta = (): Ast.Node => {
		if (!this.body) {
			return Ast.value(this)
		}

		const {fnType} = this

		const typeVars = [...getTypeVars(fnType)].map(tv => tv.name)
		const params = mapValues(fnType.params, p => p.toAst())
		const rest = fnType.rest
			? {name: fnType.rest.name ?? '', node: fnType.rest.value.toAst()}
			: undefined

		return Ast.fnDef(
			typeVars,
			Ast.params(params, fnType.optionalPos, rest),
			this.body.clone()
		)
	}

	clone = () => {
		const value = new Fn(this.superType, this.fn, this.body)
		value.meta = this.meta
		return value
	}

	static of(params: Record<string, Value>, out: Value, fn: IFn) {
		return new Fn(FnType.of({params, out}), fn)
	}
	static from(ty: FnType, fn: IFn, body?: Ast.Node) {
		return new Fn(ty, fn, body)
	}
}

export class FnType extends BaseValue implements IFnType {
	readonly type = 'FnType' as const
	readonly superType = All.instance

	private constructor(
		public readonly params: Record<string, Value>,
		public readonly optionalPos: number,
		public readonly rest: {name: string; value: Value} | undefined,
		public readonly out: Value
	) {
		super()
		if (
			optionalPos < 0 ||
			values(params).length < optionalPos ||
			optionalPos % 1 !== 0
		) {
			throw new Error('Invalid optionalPos: ' + optionalPos)
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
			const fn = Fn.from(this, () => withLog(this.out.defaultValue))
			this.#initialDefaultValue = fn
		}
		return this.#initialDefaultValue
	}

	protected toAstExceptMeta = (): Ast.FnTypeDef => {
		const rest = this.rest
			? {name: this.rest.name, node: this.rest.value.toAst()}
			: undefined

		const params = mapValues(this.params, p => p.toAst())

		return Ast.fnType(
			null,
			Ast.params(params, this.optionalPos, rest),
			this.out.toAst()
		)
	}

	isEqualTo = (value: Value) =>
		this.type === value.type &&
		isEqualArray(values(this.params), values(value.params), isEqual) &&
		this.optionalPos === value.optionalPos &&
		nullishEqual(
			this.rest,
			value.rest,
			(a, b) => a.name === b.name && isEqual(a.value, b.value)
		) &&
		isEqual(this.out, value.out)

	isSubtypeOf = (value: Value): boolean => {
		if (this.superType.isSubtypeOf(value)) return true
		if (value.type === 'UnionType') return value.isSupertypeOf(this)
		if (value.type !== 'FnType') return false

		const thisParam = Vec.of(
			values(this.params),
			this.optionalPos,
			this.rest?.value
		)
		const valueParam = Vec.of(
			values(value.params),
			value.optionalPos,
			value.rest?.value
		)

		return isSubtype(valueParam, thisParam) && isSubtype(this.out, value.out)
	}

	isTypeFor!: (value: Value) => value is Fn

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
		value.meta = this.meta
		return value
	}

	static of({
		params = {},
		optionalPos,
		rest = undefined,
		out,
	}: {
		params?: Record<string, Value>
		optionalPos?: number
		rest?: FnType['rest']
		out: Value
	}) {
		const _optionalPos = optionalPos ?? values(params).length
		return new FnType(params, _optionalPos, rest, out)
	}
}

export class Vec<TItems extends Value[] = Value[]>
	extends BaseValue
	implements IFnLike
{
	readonly type = 'Vec' as const
	readonly superType = All.instance

	private constructor(
		public readonly items: TItems,
		public readonly optionalPos: number,
		public readonly rest?: Value
	) {
		super()
		if (optionalPos < 0 || items.length < optionalPos || optionalPos % 1 !== 0)
			throw new Error('Invalid optionalPos: ' + optionalPos)
	}

	#defaultValue?: Vec
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}

	get initialDefaultValue(): Vec {
		const items = this.items
			.slice(0, this.optionalPos)
			.map(it => it.defaultValue)

		return Vec.of(items)
	}

	protected toAstExceptMeta = (): Ast.Node => {
		const items = this.items.map(it => it.toAst())
		return Ast.vec(items, this.optionalPos, this.rest?.toAst())
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
			if (!ti || !isSubtype(ti, vi)) return false
		}

		if (value.rest) {
			for (let ti; (ti = tIter.next(true).value); ) {
				if (!isSubtype(ti, value.rest)) return false
			}
		}

		return true
	}

	get fnType() {
		return FnType.of({
			params: {index: NumType},
			out: unionType(...this.items),
		})
	}

	get fn(): IFn {
		return (index: Ast.Arg<Num>) => {
			const ret = this.items[index().value]
			if (ret === undefined) {
				throw new Error('Index out of range')
			}
			return withLog(ret)
		}
	}

	isTypeFor!: (value: Value) => value is Vec

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

	static of<TItems extends Value[]>(
		items: TItems = [] as any,
		optionalPos?: number,
		rest?: Value
	) {
		return new Vec(items, optionalPos ?? items.length, rest)
	}
}

export class Dict<
	TItems extends Record<string, Value> = Record<string, Value>
> extends BaseValue {
	readonly type = 'Dict' as const

	private constructor(
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

	protected toAstExceptMeta = (): Ast.DictLiteral => {
		const items = mapValues(this.items, it => it.toAst())
		return Ast.dict(items, this.optionalKeys, this.rest?.toAst())
	}

	toAst!: () => Ast.DictLiteral

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
				if (!sv || !isSubtype(sv, vi)) return false
			} else {
				const sv = k in this.items ? this.items[k] : this.rest
				if (sv && !isSubtype(sv, vi)) return false
			}
		}

		if (value.rest) {
			const sKeys = keys(this.items)
			const extraKeys = difference(sKeys, tKeys)
			for (const k of extraKeys) {
				if (!isSubtype(this.items[k], value.rest)) return false
			}
			if (this.rest && !isSubtype(this.rest, value.rest)) return false
		}

		return true
	}

	isTypeFor!: (value: Value) => value is Dict

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

	private constructor(public types: UnitableType[]) {
		super()
		if (types.length < 2) throw new Error('Too few types to create union type')
	}

	#defaultValue!: Atomic
	get defaultValue() {
		return (this.#defaultValue ??= this.initialDefaultValue)
	}
	initialDefaultValue: Atomic = this.types[0].defaultValue

	protected toAstExceptMeta = (): Ast.App => {
		const types = this.types.map(ty => ty.toAst())
		return Ast.app(Ast.id('union'), ...types)
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

	static fromTypesUnsafe(types: UnitableType[]) {
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

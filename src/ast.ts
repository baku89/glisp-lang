import {isPlainObject} from 'lodash'

export type Ast = Value | Expr

/**
 * 値。いかなる式をも含まず、評価時には必ずそのまま返される
 */
export type Value =
	| CompoundValue
	| Primitive
	| Atom
	| Type
	| Typeclass
	| Fn
	| FnType
	| All
	| Unit
	| Never

/** 複合値 */
export type CompoundValue = Vector | Dict

export function isCompoundValue(ast: Ast): ast is CompoundValue {
	return Array.isArray(ast) || isPlainObject(ast)
}

/**
 * Expression = 式。評価時には何らかの処理をし、値を求める必要がある。
 */
export type Expr = CompoundExpr | Sym

/**
 * 複合式。式をその内側に含む
 */
export type CompoundExpr = List | Scope | VectorLiteral | DictLiteral

export function isCompoundExpr(ast: Ast): ast is CompoundExpr {
	return ast instanceof BaseExpr && ast.type !== 'Sym'
}

export type CompoundAst = CompoundExpr | CompoundValue

export function isCompoundAst(ast: Ast): ast is CompoundAst {
	return isCompoundExpr(ast) || isCompoundValue(ast)
}

/**
 * JSのプリミティブ
 */
type Primitive = string | number | boolean

export const Meta = Symbol('ExprMeta')

export function isAstObject(
	value: any
): value is Exclude<Ast, Primitive | Vector | Dict> {
	return value instanceof BaseAst
}

export function isValue(ast: Ast): ast is Value {
	return (
		typeof ast !== 'object' ||
		ast instanceof BaseValue ||
		Array.isArray(ast) ||
		isPlainObject(ast)
	)
}

class BaseAst {
	readonly [Meta]?: Dict
}

class BaseExpr extends BaseAst {}

class BaseValue extends BaseAst {}

export class List extends BaseExpr {
	readonly type = 'List' as const

	readonly car: Ast
	readonly cdr: readonly Ast[]

	constructor(readonly items: readonly Ast[]) {
		super()

		this.car = items[0] ?? unit
		this.cdr = items.slice(1)
	}

	get length() {
		return this.items.length
	}
}

export function list(...items: Ast[]) {
	return new List(items)
}

/**
 * スコープ。
 * 重複したキーを持つ辞書型は許容せず、パースエラーとする。
 */
export class Scope extends BaseExpr {
	readonly type = 'Scope' as const

	constructor(readonly vars: Record<string, Ast>, readonly ret?: Ast) {
		super()
	}
}

export function scope(vars: Record<string, Ast>, ret?: Ast): Scope {
	return new Scope(vars, ret)
}

export type IFn = (...args: any[]) => Value

export class Fn extends BaseValue {
	readonly type = 'Fn' as const

	constructor(readonly fn: (...args: any[]) => Value, readonly fnType: FnType) {
		super()
	}
}

export class FnType extends BaseValue {
	readonly type = 'FnType' as const

	constructor(
		readonly args: Dict,
		readonly restArg: Value | undefined,
		readonly ret: Value
	) {
		super()
	}
}

export function fn(
	fn: IFn,
	type: {
		args?: Dict
		return: Value
		restArg?: Value
	}
) {
	const fnType = new FnType(type.args ?? {}, type.restArg, type.return)
	return new Fn(fn, fnType)
}

/**
 * すべての値を表す型。TypeScriptの`unknown`に相当する。
 */
export class All extends BaseValue {
	readonly type = 'All' as const
}

export const all: All = new All()

/**
 * 何にでも評価される値を表す型。TypeScriptの`any`に相当する。
 * Haskellの`()`に相当する。
 */
export class Unit extends BaseValue {
	readonly type = 'Unit' as const
}

export const unit = new Unit()

/**
 * 絶対に存在しない値を表す型。TypeScriptの`never`に相当する。
 */
export class Never extends BaseValue {
	readonly type = 'Never' as const
}

export const never = new Never()

export const Current = Symbol('.')
export const Parent = Symbol('..')

export type Key = string | number | typeof Current | typeof Parent
export type Prop = string | number

/**
 * シンボル。Glispにおけるシンボルは、構文木における特定の位置を相対パスで参照するもの。
 */
export class Sym extends BaseExpr {
	readonly type = 'Sym' as const

	constructor(
		readonly path: readonly Key[],
		readonly props: readonly Prop[] = []
	) {
		super()
	}
}

/**
 * テンプレート構文で s`+` のように呼び出して、Symのインスタンスを返す
 */
export function s(strings: TemplateStringsArray): Sym {
	return new Sym(strings.raw, [])
}

/**
 * 型を表す値。
 */
export class Type<T = any> extends BaseValue {
	readonly type = 'Type' as const
	readonly id: string
	readonly defaultValue: T

	/**
	 * その値と同値な値へと評価される式を返す
	 */
	readonly toAst: (value: T) => Value

	readonly toPrimitive?: (value: T) => Primitive

	constructor({
		id,
		defaultValue,
		toAst,
		toPrimitive,
	}: {
		id: string
		defaultValue: T
		toAst: (value: T) => Value
		toPrimitive?: (value: T) => Primitive
	}) {
		super()
		this.id = id
		this.defaultValue = defaultValue
		this.toAst = toAst
		this.toPrimitive = toPrimitive
	}
}

/**
 * 型を作る型。
 * 配列型やタプル型、辞書型なども、ひとまず実装をシンプルにするためにこれを用いる。
 * `number[]` が `(Vector Number)`、`Record<string, boolean`が`(Dict Boolean)`など。
 */
export class Typeclass extends BaseValue {
	readonly type = 'Typeclass' as const

	constructor(readonly id: string, readonly args: readonly Value[]) {
		super()
	}
}

export class Atom<T = any> extends BaseValue {
	readonly type = 'Atom' as const;
	readonly [Meta] = {}

	constructor(readonly value: T, readonly superType: Type<T>) {
		super()
	}

	toPrimitive() {
		return this.superType.toPrimitive?.(this.value)
	}

	toAst() {
		return this.superType.toAst(this.value)
	}
}

export function isAtom(value: Value): value is Atom {
	return value instanceof Atom
}

export type Vector = Value[]

export class VectorLiteral extends BaseExpr {
	readonly type = 'VectorLiteral' as const

	constructor(readonly items: readonly Ast[]) {
		super()
	}

	get length() {
		return this.items.length
	}
}

export function vector(...items: Ast[]) {
	return new VectorLiteral(items)
}

/**
 * 辞書。
 */
export interface Dict {
	readonly [key: string]: Value
}

export function isDict(ast: Ast): ast is Dict {
	return isPlainObject(ast)
}

/**
 * 辞書リテラル。
 */
export class DictLiteral extends BaseExpr {
	readonly type = 'DictLiteral' as const

	constructor(readonly entries: readonly (readonly [string, Ast])[]) {
		super()
	}
}

export function dict(...entries: (readonly [string, Ast])[]) {
	return new DictLiteral(entries)
}

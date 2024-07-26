export type Ast = Value | Expr

export type Value =
	| Primitive
	| Atom
	| Type
	| Typeclass
	| Fn
	| FnType
	| All
	| Unit
	| Never
	| Vector
	| Dict

export type Expr = List | Scope | Sym | VectorLiteral | DictLiteral

/**
 * JSのプリミティブ
 */
type Primitive = string | number | boolean

export const Meta = Symbol('ExprMeta')
export const ParserInfo = Symbol('ParserMeta')

export function isAstObject(
	value: any
): value is Exclude<Ast, Primitive | Vector | Dict> {
	return value instanceof BaseAst
}

class BaseAst {
	readonly [Meta]?: Dict
}

export class List extends BaseAst {
	readonly type = 'List' as const

	readonly car: Ast
	readonly cdr: readonly Ast[]

	constructor(readonly items: readonly Ast[]) {
		super()

		this.car = items[0] ?? unit
		this.cdr = items.slice(1)
	}
}

export function list(...items: Ast[]) {
	return new List(items)
}

/**
 * スコープ。
 * 重複したキーを持つ辞書型は許容せず、パースエラーとする。
 */
export class Scope extends BaseAst {
	readonly type = 'Scope' as const

	constructor(readonly vars: Dict, readonly ret?: Value) {
		super()
	}
}

export function scope(vars: Dict, ret?: Value): Scope {
	return new Scope(vars, ret)
}

export type IFn = (...args: any[]) => Value

export class Fn extends BaseAst {
	readonly type = 'Fn' as const

	constructor(readonly fn: (...args: any[]) => Value, readonly fnType: FnType) {
		super()
	}
}

export class FnType extends BaseAst {
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
export class All extends BaseAst {
	readonly type = 'All' as const
}

export const all: All = new All()

/**
 * 何にでも評価される値を表す型。TypeScriptの`any`に相当する。
 * Haskellの`()`に相当する。
 */
export class Unit extends BaseAst {
	readonly type = 'Unit' as const
}

export const unit = new Unit()

/**
 * 絶対に存在しない値を表す型。TypeScriptの`never`に相当する。
 */
export class Never extends BaseAst {
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
export class Sym extends BaseAst {
	readonly type = 'Sym' as const

	constructor(readonly path: readonly Key[], readonly props: readonly Prop[]) {
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
export class Type<T = any> extends BaseAst {
	readonly type = 'Type' as const
	readonly id: string
	readonly defaultValue: T

	/**
	 * その値と同値な値へと評価される式を返す
	 */
	readonly toExpr: (value: T) => Value

	readonly toPrimitive?: (value: T) => Primitive

	constructor({
		id,
		defaultValue,
		toExpr,
		toPrimitive,
	}: {
		id: string
		defaultValue: T
		toExpr: (value: T) => Value
		toPrimitive?: (value: T) => Primitive
	}) {
		super()
		this.id = id
		this.defaultValue = defaultValue
		this.toExpr = toExpr
		this.toPrimitive = toPrimitive
	}
}

/**
 * 型を作る型。
 * 配列型やタプル型、辞書型なども、ひとまず実装をシンプルにするためにこれを用いる。
 * `number[]` が `(Vector Number)`、`Record<string, boolean`が`(Dict Boolean)`など。
 */
export class Typeclass extends BaseAst {
	readonly type = 'Typeclass' as const

	constructor(readonly id: string, readonly args: readonly Value[]) {
		super()
	}
}

export class Atom<T = any> extends BaseAst {
	readonly type = 'Atom' as const;
	readonly [Meta] = {}

	constructor(readonly value: T, readonly superType: Type<T>) {
		super()
	}

	toPrimitive() {
		return this.superType.toPrimitive?.(this.value)
	}
}

export function isAtom(value: Value): value is Atom {
	return value instanceof Atom
}

export type Vector = Value[]

export class VectorLiteral extends BaseAst {
	readonly type = 'VectorLiteral' as const

	constructor(readonly items: readonly Expr[]) {
		super()
	}
}

/**
 * 辞書。
 */
export interface Dict {
	readonly [key: string]: Value
}

/**
 * 辞書リテラル。
 */
export class DictLiteral extends BaseAst {
	readonly type = 'DictLiteral' as const

	constructor(readonly entries: [string, Value][]) {
		super()
	}
}

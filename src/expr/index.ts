import {Value} from '../value'
import {
	App,
	DictLiteral,
	Expr,
	FnDef,
	NumberLiteral,
	ParamsDef,
	Scope,
	StringLiteral,
	Symbol,
	TryCatch,
	TypeVarsDef,
	ValueContainer,
	ValueMeta,
	VecLiteral,
} from './expr'

export {AtomExpr as LeafNode, InnerNode, Arg} from './expr'

// export {NodeMeta} from './expr'

export {isSame, print, PrintOptions, clone} from './expr'

// Exp
export {
	Expr,
	Symbol,
	ValueContainer,
	NumberLiteral,
	StringLiteral,
	App,
	Scope,
	TryCatch,
	FnDef,
	TypeVarsDef,
	ParamsDef,
	VecLiteral,
	DictLiteral,
	ValueMeta,
}

export const symbol = (name: string) => new Symbol(name)

export const valueContainer = <V extends Value = Value>(value: V) =>
	new ValueContainer(value)

export const numberLiteral = (value: number) => new NumberLiteral(value)

export const stringLiteral = (value: string) => new StringLiteral(value)

export const app = (fn?: Expr, ...args: Expr[]) => new App(fn, ...args)

export const scope = (items?: Record<string, Expr>, ret?: Expr) =>
	new Scope(items, ret)

export const tryCatch = (block: Expr, handler: Expr) =>
	new TryCatch(block, handler)

export const valueMeta = (meta: Expr, value: Expr) => new ValueMeta(meta, value)

export const fnDef = (
	typeVars: TypeVarsDef | string[] | null | undefined,
	param: ParamsDef | Record<string, Expr>,
	returnType: Expr | null,
	body: Expr | null
) => new FnDef(typeVars, param, returnType, body)

export const paramsDef = (
	items?: Record<string, Expr> | null,
	optionalPos?: number | null,
	rest?: ParamsDef['rest'] | null
) => new ParamsDef(items, optionalPos, rest)

export const vec = (
	items?: Expr[] | null,
	optionalPos?: number | null,
	rest?: Expr | null
) => new VecLiteral(items, optionalPos, rest)

export const dict = (
	items?: Record<string, Expr> | null,
	optionalKeys?: Iterable<string> | null,
	rest?: Expr | null
) => new DictLiteral(items, optionalKeys, rest)

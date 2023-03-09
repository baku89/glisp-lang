import {Value} from '../value'
import {
	App,
	DictLiteral,
	Expr,
	FnDef,
	Identifier,
	NumLiteral,
	ParamsDef,
	Scope,
	StrLiteral,
	TryCatch,
	TypeVarsDef,
	ValueContainer,
	ValueMeta,
	VecLiteral,
} from './expr'

export {AtomExpr as LeafNode, InnerNode, Arg} from './expr'

export {NodeMeta} from './expr'

export {isSame, print, PrintOptions, clone} from './expr'

// Exp
export {
	Expr,
	Identifier,
	ValueContainer,
	NumLiteral,
	StrLiteral,
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

export const id = (name: string) => new Identifier(name)

export const valueContainer = <V extends Value = Value>(value: V) =>
	new ValueContainer(value)

export const num = (value: number) => new NumLiteral(value)

export const str = (value: string) => new StrLiteral(value)

export const app = (fn?: Expr, ...args: Expr[]) => new App(fn, ...args)

export const scope = (items: Record<string, Expr>, ret?: Expr) =>
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
	items: Record<string, Expr>,
	optionalPos: number,
	rest?: {name: string; expr: Expr}
) => new ParamsDef(items, optionalPos, rest)

export const vec = (items: Expr[] = [], optionalPos?: number, rest?: Expr) =>
	new VecLiteral(items, optionalPos, rest)

export const dict = (
	items: Record<string, Expr> = {},
	optionalKeys: Iterable<string> = [],
	rest?: Expr
) => new DictLiteral(items, optionalKeys, rest)

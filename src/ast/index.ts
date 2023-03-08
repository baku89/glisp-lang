import {Value} from '../val'
import {
	AllKeyword,
	App,
	DictLiteral,
	FnDef,
	FnTypeDef,
	Identifier,
	NeverKeyword,
	Node,
	NumLiteral,
	ParamDef,
	Scope,
	StrLiteral,
	TryCatch,
	TypeVarsDef,
	ValueContainer,
	ValueMeta,
	VecLiteral,
} from './ast'

export {LeafNode, InnerNode, Arg} from './ast'

export {NodeMeta} from './ast'

export {isSame, print, clone} from './ast'

// Exp
export {
	Node,
	Identifier,
	ValueContainer,
	AllKeyword,
	NeverKeyword,
	NumLiteral,
	StrLiteral,
	App as Call,
	Scope,
	TryCatch,
	FnDef,
	FnTypeDef,
	TypeVarsDef,
	ParamDef,
	VecLiteral,
	DictLiteral,
	ValueMeta,
}

export const id = (name: string) => new Identifier(name)

export const value = <V extends Value = Value>(value: V) =>
	new ValueContainer(value)

export const all = () => new AllKeyword()

export const never = () => new NeverKeyword()

export const num = (value: number) => new NumLiteral(value)

export const str = (value: string) => new StrLiteral(value)

export const app = (fn?: Node, ...args: Node[]) => new App(fn, ...args)

export const scope = (items: Record<string, Node>, ret?: Node) =>
	new Scope(items, ret)

export const tryCatch = (block: Node, handler: Node) =>
	new TryCatch(block, handler)

export const valueMeta = (meta: Node, value: Node) => new ValueMeta(meta, value)

export const fnDef = (
	typeVars: TypeVarsDef | string[] | null | undefined,
	param: ParamDef | Record<string, Node>,
	body: Node
) => new FnDef(typeVars, param, body)

export const fnType = (
	typeVars: TypeVarsDef | string[] | null | undefined,
	param: ParamDef | Record<string, Node>,
	out: Node
) => new FnTypeDef(typeVars, param, out)

export const param = (
	items: Record<string, Node>,
	optionalPos: number,
	rest?: {name: string; node: Node}
) => new ParamDef(items, optionalPos, rest)

export const vec = (items: Node[] = [], optionalPos?: number, rest?: Node) =>
	new VecLiteral(items, optionalPos, rest)

export const dict = (
	items: Record<string, Node> = {},
	optionalKeys: Iterable<string> = [],
	rest?: Node
) => new DictLiteral(items, optionalKeys, rest)

import {
	AllKeyword,
	App,
	DictLiteral,
	FnDef,
	FnTypeDef,
	Identifier,
	NeverKeyword,
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

export {Node, LeafNode, InnerNode, Arg} from './ast'

export {NodeMeta} from './ast'

export {isSame, print, setParent, clone} from './ast'

// Exp
export {
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

export const id = Identifier.of
export const value = ValueContainer.of
export const all = AllKeyword.of
export const never = NeverKeyword.of
export const num = NumLiteral.of
export const str = StrLiteral.of
export const app = App.of
export const scope = Scope.of
export const tryCatch = TryCatch.of
export const valueMeta = ValueMeta.of

export const fn = FnDef.of
export const fnType = FnTypeDef.of
export const param = ParamDef.of

export const vec = VecLiteral.of
export const dict = DictLiteral.of

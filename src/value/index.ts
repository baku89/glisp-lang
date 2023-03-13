import {
	All,
	Dict,
	Enum,
	EnumType,
	Fn,
	FnType,
	IFn,
	Never,
	Number,
	NumberType,
	Prim,
	PrimType,
	String,
	StringType,
	TypeVar,
	UnionType,
	Unit,
	Value,
	Vec,
} from './value'

export {IFn, Value}

// Value
export {
	All,
	Never,
	Unit,
	Number,
	String,
	Prim,
	PrimType,
	TypeVar,
	Enum,
	EnumType,
	Fn,
	FnType,
	Vec,
	Dict,
	UnionType,
}

const BooleanType = EnumType.of('Boolean', ['false', 'true'])
const True = BooleanType.getEnum('true')
const False = BooleanType.getEnum('false')

export {NumberType, StringType, BooleanType, True, False}

export const all = All.instance
export const never = Never.instance
export const unit = Unit.instance
export const number = (value: number) => new Number(value)
export const string = (value: string) => new String(value)
export const boolean = (value: boolean) => (value ? True : False)
export const primType = PrimType.of
export const enumType = EnumType.of
export const fn = Fn.of
export const fnFrom = Fn.from
export const fnType = FnType.of
export const typeVar = TypeVar.of
export const vec = Vec.of
export const dict = Dict.of

export {isEqual, isSubtype} from './value'

export {unionType, differenceType, intersectionType} from './TypeOperation'

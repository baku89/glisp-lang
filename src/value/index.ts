import {Expr} from '../expr'
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

export type {IFn, Value}

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

const BooleanType = new EnumType('Boolean', ['false', 'true'])
const True = BooleanType.getEnum('true')
const False = BooleanType.getEnum('false')

export {NumberType, StringType, BooleanType, True, False}

export const all = All.instance
export const never = Never.instance
export const unit = Unit.instance

export const number = (value: number) => new Number(value)
export const string = (value: string) => new String(value)
export const boolean = (value: boolean) => (value ? True : False)

export const primType = <T>(name: string, initialDefaultValue: T) =>
	new PrimType(name, initialDefaultValue)

export const enumType = (name: string, labels: string[]) =>
	new EnumType(name, labels)

export const fn = (fnType: FnType, fnObj: IFn, body?: Expr) =>
	new Fn(fnType, fnObj, body)

interface IFnTypeConstructor {
	(params: FnType['params'], out: Value): FnType
	(
		params: FnType['params'],
		optionalPos: number | null,
		rest: FnType['rest'],
		out: Value
	): FnType
	(
		params: FnType['params'],
		outOrOptionalPos: number | Value | null,
		rest?: FnType['rest'],
		out?: Value
	): FnType
}

export const fnType: IFnTypeConstructor = (
	params,
	outOrOptionalPos,
	rest?,
	out?
) => new FnType(params, outOrOptionalPos as any, rest as any, out as any)

export const typeVar = (name: string) => new TypeVar(name)

export const vec = <V extends Value = Value>(
	items?: V[],
	optionalPos?: number,
	rest?: Value
) => new Vec(items, optionalPos, rest)

export const dict = Dict.of

export {isEqual, isSubtype} from './value'

export {unionType, differenceType, intersectionType} from './TypeOperation'

//chigyo+baku=OH CUTE~~~!!!!!

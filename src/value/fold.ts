import {values} from 'lodash'

import type * as Val from './value'

type ValueType = Val.Value['type']

type TypeToValue<T extends ValueType> = T extends 'All'
	? Val.All
	: T extends 'PrimType'
	? Val.PrimType
	: T extends 'EnumType'
	? Val.EnumType
	: T extends 'FnType'
	? Val.FnType
	: T extends 'UnionType'
	? Val.UnionType
	: T extends 'TypeVar'
	? Val.TypeVar
	: T extends 'Never'
	? Val.Never
	: T extends 'Unit'
	? Val.Unit
	: T extends 'Prim'
	? Val.Prim
	: T extends 'Enum'
	? Val.Enum
	: T extends 'Fn'
	? Val.Fn
	: T extends 'Vec'
	? Val.Vec
	: T extends 'Dict'
	? Val.Dict
	: Val.Value

type Visitors<U> = {
	[T in ValueType]?: (value: TypeToValue<T>) => U
}

export function createFoldFn<U>(
	visitors: Visitors<U>,
	defaultFn: (value: Val.Value) => U,
	concat: (...xs: U[]) => U
) {
	return function fold(value: Val.Value): U {
		const type = value.type

		switch (type) {
			case 'All':
				return (visitors[type] ?? defaultFn)(value)
			case 'Never':
				return (visitors[type] ?? defaultFn)(value)
			case 'Unit':
				return (visitors[type] ?? defaultFn)(value)
			case 'PrimType':
				return (visitors[type] ?? defaultFn)(value)
			case 'Prim':
				return (visitors[type] ?? defaultFn)(value)
			case 'EnumType':
				return (visitors[type] ?? defaultFn)(value)
			case 'Enum':
				return (visitors[type] ?? defaultFn)(value)
			case 'FnType': {
				const f = visitors[type] ?? defaultFn

				const us = [f(value), ...values(value.params).map(fold)]
				if (value.rest) us.push(fold(value.rest.value))
				us.push(fold(value.ret))

				return concat(...us)
			}
			case 'Fn': {
				const f = visitors[type] ?? defaultFn
				return concat(f(value), fold(value.fnType))
			}
			case 'Vec': {
				const f = visitors[type] ?? defaultFn

				const us = [f(value), ...value.items.map(fold)]
				if (value.rest) us.push(fold(value))

				return concat(...us)
			}
			case 'Dict': {
				const f = visitors[type] ?? defaultFn

				const us = [f(value), ...values(value.items).map(fold)]
				if (value.rest) us.push(fold(value.rest))

				return concat(...us)
			}
			case 'TypeVar':
				return (visitors[type] ?? defaultFn)(value)
			case 'UnionType': {
				const f = visitors[type] ?? defaultFn
				return concat(f(value), ...value.types.map(fold))
			}
		}
	}
}

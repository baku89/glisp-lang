import {identity} from 'lodash'

import {scope, Type} from './ast'

export const Number = new Type<number>({
	id: 'number',
	defaultValue: 0,
	toExpr: identity,
	toPrimitive: identity,
})

export const String = new Type<string>({
	id: 'string',
	defaultValue: '',
	toExpr: identity,
	toPrimitive: identity,
})

export const Boolean = new Type<boolean>({
	id: 'boolean',
	defaultValue: false,
	toExpr: identity,
	toPrimitive: identity,
})

export const Prelude = scope({
	true: true,
	false: false,
	Number,
	String,
	Boolean,
})

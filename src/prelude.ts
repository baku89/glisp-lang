import {identity} from 'lodash'

import {fn, scope, Type} from './ast'

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

	// Arithmetic
	'+': fn((...xs: number[]) => xs.reduce((acc, x) => acc + x, 0), {
		restArg: Number,
		return: Number,
	}),

	π: Math.PI,
	τ: Math.PI * 2,

	PI: Math.PI,
	TAU: Math.PI * 2,
	E: Math.E,
})

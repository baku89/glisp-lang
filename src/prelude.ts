import {identity} from 'lodash'

import {all, fn, never, scope, Type} from './ast'
import {Env} from './env'

export const Number = new Type<number>({
	id: 'number',
	defaultValue: 0,
	toAst: identity,
	toPrimitive: identity,
})

export const String = new Type<string>({
	id: 'string',
	defaultValue: '',
	toAst: identity,
	toPrimitive: identity,
})

export const Boolean = new Type<boolean>({
	id: 'boolean',
	defaultValue: false,
	toAst: identity,
	toPrimitive: identity,
})

const Prelude = scope({
	'***': all,
	'_|_': never,
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

export const PreludeEnv = new (Env as any)(Prelude) as Env

import type {Expr} from './expr'
import {Writer} from './util/Writer'
import type {Value} from './value'

export type WithLog<V extends Value = Value> = Writer<V, Log>

export interface Log {
	level: 'error' | 'warn' | 'info'
	reason: string
	ref?: Expr
}

export function withLog<V extends Value = Value>(
	value: V,
	...log: Log[]
): WithLog<V> {
	return Writer.of(value, ...log)
}

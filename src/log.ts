import type {Node} from './ast'
import {Writer} from './util/Writer'
import {Value} from './value'

export type WithLog<V extends Value = Value> = Writer<V, Log>

export interface Log {
	level: 'error' | 'warn' | 'info'
	reason: string
	ref: Node
}

export function withLog<V extends Value = Value>(
	value: V,
	...log: Log[]
): WithLog<V> {
	return Writer.of(value, ...log)
}

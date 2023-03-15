export * as Expr from './expr'
export * as Value from './value'

import {InnerNode} from './expr'
import {Parser} from './parser'
import {PreludeScope} from './std/prelude'

export {withLog} from './log'
export type {WithLog, Log} from './log'

export {PreludeScope}

export function tryParse(input: string, outer: InnerNode = PreludeScope) {
	const expr = Parser.Program.tryParse(input)
	expr.parent = outer
	return expr
}

export function parse(input: string, outer: InnerNode = PreludeScope) {
	const result = Parser.Program.parse(input)
	if (result.status) {
		result.value.parent = outer
	}
	return result
}

export * from './expr'
export type {Expr, AnyExpr, AtomExpr, ParentExpr} from './expr'
export * from './value'
export type {IFn, Value} from './value'
export {Parser} from './parser'
export * from './std/prelude'
export * from './log'
export type {WithLog, Log} from './log'
export {EvalError} from './EvalError'

export {withLog} from './log'

import type {ParentExpr} from './expr'
import {Parser} from './parser'
import {PreludeScope} from './std'

export function tryParse(input: string, outer: ParentExpr = PreludeScope) {
	const expr = Parser.Program.tryParse(input)
	expr.parent = outer
	return expr
}

export function parse(input: string, outer: ParentExpr = PreludeScope) {
	const result = Parser.Program.parse(input)
	if (result.status) {
		result.value.parent = outer
	}
	return result
}

export * from './expr'
export type {Expr, AnyExpr, AtomExpr, ParentExpr} from './expr'
export * from './value'
export type {IFn, Value} from './value'
export {Parser} from './parser'
export * from './std/prelude'
export * from './Log'
export type {Log} from './Log'
export {EvalError} from './EvalError'

import type {ParentExpr} from './expr'
import {Parser} from './parser'
import {PreludeScope} from './std'

export function tryParse(input: string, parent: ParentExpr = PreludeScope) {
	const expr = Parser.Program.tryParse(input)
	expr.parent = parent
	return expr
}

export function parse(input: string, parent: ParentExpr = PreludeScope) {
	const result = Parser.Program.parse(input)
	if (result.status) {
		result.value.parent = parent
	}
	return result
}

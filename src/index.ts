import * as Expr from './expr'
import {Parser} from './parser'
import {PreludeScope} from './std/prelude'
import * as Value from './value'

export {Expr, Value, PreludeScope}

export function parse(input: string) {
	const expr = Parser.Program.tryParse(input)
	expr.parent = PreludeScope
	return expr
}

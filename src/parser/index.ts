import {app, Expr, InnerNode} from '../expr'
import * as ExprModule from '../expr'
import parser from './parser.peg.js'

const PegImports = {Expr: ExprModule}

export function parse(str: string, parent: InnerNode | null = null): Expr {
	const expr: Expr | undefined = parser.parse(str, PegImports)
	if (!expr) return app()

	expr.parent = parent

	return expr
}

export function parseModule(str: string): Record<string, Expr> {
	const expr: Expr | undefined = parser.parse('(let ' + str + ')', PegImports)
	if (!expr || expr.type !== 'Scope') return {}

	return expr.items
}

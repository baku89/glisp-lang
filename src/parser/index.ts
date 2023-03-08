import * as Expr from '../expr'
import parser from './parser.peg.js'

export function parse(
	str: string,
	parent: Expr.InnerNode | null = null
): Expr.Node {
	const node: Expr.Node | undefined = parser.parse(str, {Expr})
	if (!node) return Expr.app()

	node.parent = parent

	return node
}

export function parseModule(str: string): Record<string, Expr.Node> {
	const node: Expr.Node | undefined = parser.parse('(let ' + str + ')', {Expr})
	if (!node || node.type !== 'Scope') return {}

	return node.vars
}

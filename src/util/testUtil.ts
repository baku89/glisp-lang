import * as Ast from '../ast'
import {Log} from '../log'
import * as Parser from '../parser'
import {PreludeScope} from '../std/prelude'
import {Value} from '../value'

export function parse(
	input: string | Ast.Node,
	parent: Ast.InnerNode = PreludeScope
): Ast.Node {
	let ast: Ast.Node
	if (typeof input === 'string') {
		ast = Parser.parse(input, parent)
	} else {
		ast = input
		ast.parent = parent
	}
	return ast
}

export function evaluate(input: string | Ast.Node): Value {
	return parse(input).eval().result
}

export function testEval(
	input: Ast.Node | string,
	expected: Value | string,
	hasLog = false
) {
	const iStr = typeof input === 'string' ? input : input.print()
	const eStr = typeof expected === 'string' ? expected : expected.print()

	test(`${iStr} evaluates to ${eStr}`, () => {
		const node = parse(input)
		const expectedVal = parse(input).eval().result

		const {result, log} = node.eval()
		if (!result.isEqualTo(expectedVal)) {
			throw new Error('Got=' + result.print())
		}
		if (!hasLog && log.size > 0) {
			throw new Error('Expected no log, but got=' + printLog(log))
		}
	})
}

export function printLog(log: Set<Log>) {
	return [...log].map(l => `[${l.level}] ${l.reason}\n`).join('')
}

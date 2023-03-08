import * as Expr from '../expr'
import {Log} from '../log'
import * as Parser from '../parser'
import {PreludeScope} from '../std/prelude'
import {Value} from '../value'

export function parse(
	input: string | Expr.Node,
	parent: Expr.InnerNode = PreludeScope
): Expr.Node {
	let expr: Expr.Node
	if (typeof input === 'string') {
		expr = Parser.parse(input, parent)
	} else {
		expr = input
		expr.parent = parent
	}
	return expr
}

export function evaluate(input: string | Expr.Node): Value {
	return parse(input).eval().result
}

export function testEval(
	input: Expr.Node | string,
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

import type {Expr, InnerNode} from '../expr'
import {Log} from '../log'
import * as Parser from '../parser'
import {PreludeScope} from '../std/prelude'
import type {Value} from '../value'

export function parse(
	input: string | Expr,
	parent: InnerNode = PreludeScope
): Expr {
	let expr: Expr
	if (typeof input === 'string') {
		expr = Parser.parse(input, parent)
	} else {
		expr = input
		expr.parent = parent
	}
	return expr
}

export function evaluate(input: string | Expr): Value {
	return parse(input).eval().result
}

export function testEval(
	input: Expr | string,
	expected: Value | string,
	hasLog = false
) {
	const iString = typeof input === 'string' ? input : input.print()
	const eString = typeof expected === 'string' ? expected : expected.print()

	test(`${iString} evaluates to ${eString}`, () => {
		const expr = parse(input)
		const expectedVal = parse(input).eval().result

		const {result, log} = expr.eval()
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

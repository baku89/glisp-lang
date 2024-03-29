import {tryParse} from '..'
import type {Expr} from '../expr'
import {Log} from '../Log'
import type {Value} from '../value'

export function evaluate(input: string | Expr): Value {
	if (typeof input === 'string') {
		return tryParse(input).eval()
	}
	return input.eval()
}

export function testEval(
	input: string,
	expected: Value | string,
	// eslint-disable-next-line no-unused-vars
	hasLog = false
) {
	const eString = typeof expected === 'string' ? expected : expected.print()

	test(`${input} evaluates to ${eString}`, () => {
		const expr = tryParse(input)
		const expectedVal = tryParse(input).eval()

		const result = expr.eval()

		if (!result.isEqualTo(expectedVal)) {
			throw new Error('Got=' + result.print())
		}

		const log = result.log

		if (!hasLog && log.size > 0) {
			throw new Error('Expected no log, but got=' + printLog(log))
		}

		if (hasLog && log.size === 0) {
			throw new Error('Expected logs, but no log')
		}
	})
}

export function printLog(log: Set<Log>) {
	return [...log].map(l => `[${l.level}] ${l.reason}\n`).join('')
}

import {expect, test} from 'vitest'

import {all, list, never, s, unit} from './ast'
import {evaluate} from './eval'

test('evaluating literals', () => {
	expect(evaluate(0)).toBe(0)
	expect(evaluate(never)).toBe(never)
	expect(evaluate(all)).toBe(all)
	expect(evaluate(unit)).toBe(unit)
	expect(evaluate('foo')).toBe('foo')
	expect(evaluate(true)).toBe(true)
	expect(evaluate(false)).toBe(false)
})

test('evaluating vectors', () => {
	expect(evaluate([])).toStrictEqual([])
	expect(evaluate([0])).toStrictEqual([0])
})

test('evaluating simple expression', () => {
	expect(evaluate(s`undefinedVar`)).toBe(unit)
	expect(evaluate(s`π`)).toBe(Math.PI)
	expect(evaluate(list(s`+`, 1, 2))).toBe(3)
})

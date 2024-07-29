import {describe, expect, test} from 'vitest'

import {all, list, never, s, scope, unit} from './ast'
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

describe('detecting circular reference', () => {
	test('{x = x x} should throw', () => {
		const ret = evaluate(scope({x: s`x`}, s`x`))
		expect(ret).toBe(unit)
	})

	// testEval('(let x: y y: x x)', '()', true)

	// testEval('[./0]', '()', true)
	// testEval('[./1 ./2 ./0]', '()', true)

	// testEval('{x: ./x}', '()', true)
	// testEval('{x: ./y y: ./x}', '()', true)
	// testEval('{x: ./y y: [../x]}', '()', true)
	// testEval('{x: ./y/0 y: [../x]}', '()', true)

	// TODO: Let the below tests pass
	// testEval('(+ ./1)', '()', true)
	// testEval('(if true ./else ./then)', '()', true)
	// testEval('(inc (inc ../x))', '()', true)
})

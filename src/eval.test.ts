import {describe, expect, test} from 'vitest'

import {all, list, never, s, scope, unit, vector} from './ast'
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

	test('{x = y y = x x} should throw', () => {
		const ret = evaluate(scope({x: s`y`, y: s`x`}, s`x`))
		expect(ret).toBe(unit)
	})

	test('[./0] should throw', () => {
		const ret = evaluate(vector(s`./0`))
		expect(ret).toStrictEqual([unit])
	})

	test('[./1 ./2 ./0] should throw', () => {
		const ret = evaluate(vector(s`./1`, s`./2`, s`./0`))
		expect(ret).toStrictEqual([unit, unit, unit])
	})

	test('{x = ./x} should throw', () => {
		const ret = evaluate(scope({x: s`./x`}, s`x`))
		expect(ret).toBe(unit)
	})

	test('{x = ./y y = ./x} should throw', () => {
		const ret = evaluate(scope({x: s`./y`, y: s`./x`}, s`x`))
		expect(ret).toBe(unit)
	})

	test('{x: ./y y: [../x]} should throw', () => {
		const ret = evaluate(scope({x: s`./y`, y: vector(s`../x`)}, s`x`))
		expect(ret).toBe(unit)
	})

	test('{x: ./y/0 y: [../x]} should throw', () => {
		const ret = evaluate(scope({x: s`./y/0`, y: vector(s`../x`)}, s`x`))
		expect(ret).toBe(unit)
	})

	// TODO: Let the below tests pass
	// testEval('(+ ./1)', '()', true)
	// testEval('(if true ./else ./then)', '()', true)
	// testEval('(inc (inc ../x))', '()', true)
})

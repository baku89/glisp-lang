import {describe, expect, test} from 'vitest'

import {all, list, never, s, scope, unit, vector} from './ast'
import {evaluate, getLogs} from './eval'
import {PreludeEnv} from './prelude'

describe('evaluating literals', () => {
	test('0 evaluates to 0', () => {
		expect(evaluate(0)).toBe(0)
	})

	test('_|_ evaluates to _|_', () => {
		expect(evaluate(never)).toBe(never)
	})

	test('*** evaluates to ***', () => {
		expect(evaluate(all)).toBe(all)
	})

	test('() evaluates to ()', () => {
		expect(evaluate(unit)).toBe(unit)
	})

	test('"foo" evaluates to "foo"', () => {
		expect(evaluate('foo')).toBe('foo')
	})

	test('true evaluates to true', () => {
		expect(evaluate(true)).toBe(true)
	})

	test('false evaluates to false', () => {
		expect(evaluate(false)).toBe(false)
	})
})

describe('evaluating vectors', () => {
	test('[] evaluates to []', () => {
		expect(evaluate([])).toStrictEqual([])
	})

	test('[0] evaluates to [0]', () => {
		expect(evaluate([0])).toStrictEqual([0])
	})
})

describe('evaluating simple expression', () => {
	test('undefined symbol evaluates to ()', () => {
		expect(evaluate(s`undefinedVar`)).toBe(unit)
	})

	test('π evaluates to Math.PI', () => {
		expect(evaluate(s`π`)).toBe(Math.PI)
	})

	test('(+ 1 2) evaluates to 3', () => {
		expect(evaluate(list(s`+`, 1, 2))).toBe(3)
	})
})

describe('detecting circular reference', () => {
	test('{x = x x} should throw', () => {
		const ret = evaluate(scope({x: s`x`}, s`x`))
		expect(ret).toBe(unit)
	})

	test('{x = y y = x x} should throw', () => {
		const ast = scope({x: s`y`, y: s`x`}, s`x`)
		const ret = evaluate(ast, PreludeEnv)
		expect(ret).toBe(unit)
		expect(getLogs(ast, PreludeEnv)).lengthOf(1)
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

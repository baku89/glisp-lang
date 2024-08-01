import {describe, expect, test} from 'vitest'

import {
	all,
	Ast,
	Current,
	dict,
	list,
	never,
	scope,
	Sym,
	unit,
	Value,
	vector,
} from './ast'
import {evaluate, getLogs} from './eval'
import {s} from './parse'
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

describe('evaluating compound expressions with relative symbols', () => {
	test('[2 ./0] evaluates to [2 2]', () => {
		expect(evaluate(vector(2, new Sym([Current, 0])))).toStrictEqual([2, 2])
	})

	test('{x: ./y y: 1} evaluates to {x: 1 y: 1}', () => {
		expect(evaluate(dict({x: s`./y`, y: 1}))).toStrictEqual({x: 1, y: 1})
	})
})

describe('detecting circular reference', () => {
	test('{x = x x} should throw', () => {
		testEvalThrow(s`x`, unit)
	})

	test('{x = y y = x x} should throw', () => {
		testEvalThrow(scope({x: s`y`, y: s`x`}, s`x`), unit)
	})

	test('[./0] should throw', () => {
		testEvalThrow(vector(s`./0`), [unit])
	})

	test('[./1 ./2 ./0] should throw', () => {
		testEvalThrow(vector(s`./1`, s`./2`, s`./0`), [unit, unit, unit])
	})

	test('(+ ./1) should throw', () => {
		testEvalThrow(list(s`+`, s`./1`), 0)
	})

	test('{x = ./y y = ./x} should throw', () => {
		testEvalThrow(scope({x: s`./y`, y: s`./x`}, s`x`), unit)
	})

	test('{x = ./y y = [../x] x} should throw', () => {
		testEvalThrow(scope({x: s`./y`, y: vector(s`../x`)}, s`x`), [unit])
	})

	// TODO: Let the below tests pass
	// testEval('(+ ./1)', '()', true)
	// testEval('(if true ./else ./then)', '()', true)
	// testEval('(inc (inc ../x))', '()', true)
})

describe('resolving a symbol', () => {
	test('resolving a symbol in Prelude', () => {
		expect(evaluate(s`true`)).toBe(true)
	})

	test('resolving a symbol in the current scope', () => {
		const sc = scope({x: 1})
		const env = PreludeEnv.pushed(sc)
		expect(evaluate(s`x`, env)).toBe(1)
	})
})

function testEvalThrow(ast: Ast, expected: Value) {
	const ret = evaluate(ast)
	expect(ret).toStrictEqual(expected)
	expect(getLogs(ast)).lengthOf(1)
}

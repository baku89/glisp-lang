import {describe, expect, test} from 'vitest'

import {unit} from './ast'
import {infer} from './infer'
import {parse, s} from './parse'
import {Number} from './prelude'

describe('inferring primitives', () => {
	test('0 should be inferred as 0', () => {
		expect(infer(0)).toBe(0)
	})
})

describe('inferring symbols', () => {
	test('undefined symbol should be inferred as ()', () => {
		expect(infer(s`undefinedVar`)).toBe(unit)
	})

	test('π should be inferred as Math.PI', () => {
		expect(infer(s`π`)).toBe(Math.PI)
	})

	test('(+ 1 2) should be inferred as Number', () => {
		expect(infer(parse(`(+ 1 2)`))).toBe(Number)
	})
})

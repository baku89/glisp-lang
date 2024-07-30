import {describe, expect, it} from 'vitest'

import {evaluate} from './eval'
import {parse} from './parse'
import {isSubtypeOf} from './TypeOperations'

describe('subtyping', () => {
	// All, Never, Unit
	test('_|_', '_|_', '=')
	test('_|_', '***', '<')
	test('_|_', '()', '<')
	test('_|_', '0', '<')
	test('_|_', 'Number', '<')
	test('0', '***', '<')
	test('Number', '***', '<')
	test('***', '***', '=')
	test('()', '()', '=')
	test('()', '0', '!=')
	test('()', '***', '<')

	// Prim, PrimType
	test('1', '1', '=')
	test('1', 'Number', '<')
	test('"hello"', '"hello"', '=')
	test('"hello"', 'String', '<')
	test('String', 'Number', '!=')
	test('"hello"', 'Number', '!=')
	test('1', '***', '<')
	test('String', 'String', '=')
	test('Number', 'Number', '=')

	// Enum
	test('true', 'true', '=')
	test('false', 'Boolean', '<')
	test('Boolean', 'Boolean', '=')

	// Vectors
	test('[]', '[]', '=')
	test('[1]', '[]', '<')
	test('[1]', '[1]', '=')
	test('[1 2]', '[1]', '<')
	test('[1]', '[true]', '!=')
	test('[1]', '[Number]', '<')
	//run('[1 Number]', '[(union 1 Boolean) Number]', '<')
	test('[1 2]', '[Number Number]', '<')
	// test('[...0]', '[...0]', '=')
	// test('[...0]', '[...1]', '!=')
	// test('[0 ...0]', '[...0]', '<')
	// test('[...0]', '[]', '=')
	// test('[0 ...0]', '[]', '<')
	// test('[0 0]', '[...0]', '<')
	// test('[0]', '[?0]', '<')
	// test('[]', '[?0]', '=')
	// test('[?0]', '[?0]', '=')
	// test('[...0]', '[?0 ...0]', '=')
	// test('[...0]', '[?0]', '=')
	// test('[0 0 ?0 ...0]', '[0 ?0]', '<')
	// test('[0 0 ?0 ...0]', '[0 ?0 ...0]', '<')

	// Dict
	test('{}', '{}', '=')
	test('{a: 0}', '{a: ***}', '<')
	test('{a: _|_}', '{a: 0}', '<')
	test('{a: 0}', '{a: 0}', '=')
	test('{a: 0}', '{a: 1}', '!=')
	test('{a: 0 b: 0}', '{a: 0}', '<')
	// test('{a:0}', '{?a:0}', '<')
	// test('{?a:0}', '{?a:0}', '=')
	// test('{}', '{?a:0}', '=')
	// test('{a:0 b:0}', '{...0}', '<')
	// test('{a:0 b:1}', '{...0}', '!=')
	// test('{?a:0}', '{...0}', '=')
	// test('{?a:0 ...1}', '{...0}', '!=')
	// test('{a:0 ...0}', '{...0}', '<')
	// test('{?a:0 ...0}', '{...0}', '=')

	// FnType
	// test('(=> []: _)', '(=> []: _)', '=')
	// test('(=> [x:_ y:_]: _)', '(=> [x:_ y:_ z:_ w:_]: _)', '<')
	// test('(=> [x:(=> [x:_]: _)]: _)', '(=> [x:(=> [] _)]: _)', '<')
	// test('(=> []: (=> []: _))', '(=> []: (=> [x:_]: _))', '<')

	// test('(=> []: 0)', '(=> [x:_]: Number)', '<')
	// test('(=> [x:Number]: _)', '(=> [x:0]: _)', '<')

	function test(xInput: string, yInput: string, expected: '<' | '=' | '!=') {
		it(`${xInput} ${expected} ${yInput}`, () => {
			const x = evaluate(parse(xInput))
			const y = evaluate(parse(yInput))

			const [x2y, y2x] =
				expected === '<'
					? [true, false]
					: expected === '='
					? [true, true]
					: [false, false]
			expect(isSubtypeOf(x, y)).toBe(x2y)
			expect(isSubtypeOf(y, x)).toBe(y2x)
		})
	}
})

// import {
// 	all,
// 	BooleanType,
// 	differenceType,
// 	False,
// 	intersectionType,
// 	never,
// 	number as num,
// 	NumberType,
// 	string as str,
// 	StringType,
// 	True,
// 	UnionType,
// 	unit,
// 	Value,
// } from '.'
// import {unionType} from './TypeOperation'

// const unite = (...types: Value[]) => UnionType.fromTypesUnsafe(types)

// const N1 = num(1)
// const N2 = num(2)
// const N3 = num(3)

// const S1 = str('foo')
// const S2 = str('bar')

// describe('uniting types', () => {
// 	test().toBe(never)
// 	test(never).toBe(never)
// 	test(all).toBe(all)
// 	test(unit).toBe(unit)
// 	test(N1).toBe(N1)
// 	test(N1, N2).toBe(unite(N1, N2))
// 	test(S1, S2).toBe(unite(S1, S2))
// 	test(N1, N2, S1).toBe(unite(N1, N2, S1))
// 	test(S1, StringType).toBe(StringType)
// 	test(unite(N1, N2), unite(N2, N3)).toBe(unite(N1, N2, N3))
// 	test(unite(N1, N2), NumberType).toBe(NumberType)
// 	test(NumberType, unite(N1, N2)).toBe(NumberType)
// 	test(NumberType, BooleanType).toBe(unite(NumberType, BooleanType))
// 	test(NumberType, never).toBe(NumberType)
// 	test(never, never).toBe(never)
// 	test(never, all).toBe(all)
// 	test(True, False).toBe(BooleanType)
// 	test(BooleanType, True, False).toBe(BooleanType)
// 	test(True, False).toBe(BooleanType)
// 	test(N2, unit).toBe(unite(N2, unit))

// 	function test(...types: Value[]) {
// 		const f = (expected: Value) => {
// 			const typesString = types.map(t => t.print()).join(', ')
// 			const expectedString = expected.print()
// 			it(`'${typesString}' to be '${expectedString}'`, () => {
// 				for (const orderedTypes of permutation(types)) {
// 					const result = unionType(...orderedTypes)
// 					if (!result.isEqualTo(expected)) {
// 						throwError(result, orderedTypes)
// 					}
// 				}
// 			})
// 		}

// 		return {toBe: f}
// 	}
// })

// describe('intersecting types', () => {
// 	test().toBe(all)
// 	test(never).toBe(never)
// 	test(unite(N1, N2), unite(N2, N3)).toBe(N2)
// 	test(N1, N2).toBe(never)
// 	test(unite(N1, N2), unite(S1, S2)).toBe(never)
// 	test(unite(N1, N2), unite(N1, N2)).toBe(unite(N1, N2))
// 	test(N1, NumberType).toBe(N1)
// 	test(unite(N1, False), N1).toBe(N1)
// 	test(unite(NumberType, False), unite(N1, N2, BooleanType)).toBe(
// 		unite(N1, N2, False)
// 	)

// 	function test(...types: Value[]) {
// 		const f = (expected: Value) => {
// 			const typesString = types.map(t => t.print()).join(', ')
// 			const expectedString = expected.print()
// 			it(`'${typesString}' to be '${expectedString}'`, () => {
// 				for (const orderedTypes of permutation(types)) {
// 					const result = intersectionType(...orderedTypes)
// 					if (!result.isEqualTo(expected)) {
// 						throwError(result, orderedTypes)
// 					}
// 				}
// 			})
// 		}

// 		return {toBe: f}
// 	}
// })

// describe('differential types', () => {
// 	// X = X
// 	test(all).toBe(all)
// 	test(never).toBe(never)
// 	test(unit).toBe(unit)

// 	// A - A = Never
// 	test(all, all).toBe(never)
// 	test(never, never).toBe(never)
// 	test(N1, N1).toBe(never)
// 	test(S1, S1).toBe(never)
// 	test(True, True).toBe(never)
// 	test(NumberType, NumberType).toBe(never)
// 	test(StringType, StringType).toBe(never)
// 	test(BooleanType, BooleanType).toBe(never)
// 	test(unite(N1, N2), unite(N1, N2)).toBe(never)

// 	// T - S = T
// 	test(all, N1).toBe(all)
// 	test(NumberType, N1).toBe(NumberType)
// 	test(all, N1).toBe(all)

// 	// Enum substraction
// 	test(BooleanType, True).toBe(False)
// 	test(BooleanType, True, False).toBe(never)
// 	test(unite(BooleanType, N1), True).toBe(unite(N1, False))
// 	test(unite(BooleanType, N1), True, N1).toBe(False)

// 	function test(original: Value, ...types: Value[]) {
// 		const f = (expected: Value) => {
// 			const typesString = types.map(t => t.print()).join(', ')
// 			const expectedString = expected.print()
// 			it(`'${typesString}' to be '${expectedString}'`, () => {
// 				for (const orderedTypes of permutation(types)) {
// 					const result = differenceType(original, ...orderedTypes)
// 					if (!result.isEqualTo(expected)) {
// 						throwError(result, orderedTypes)
// 					}
// 				}
// 			})
// 		}

// 		return {toBe: f}
// 	}
// })

// function permutation<T>(inputArr: T[]) {
// 	const result: T[][] = []

// 	const permute = (arr: T[], m: T[] = []) => {
// 		if (arr.length === 0) {
// 			result.push(m)
// 		} else {
// 			for (let i = 0; i < arr.length; i++) {
// 				const curr = arr.slice()
// 				const next = curr.splice(i, 1)
// 				permute(curr.slice(), m.concat(next))
// 			}
// 		}
// 	}

// 	permute(inputArr)

// 	return result
// }

// function throwError(result: Value, orderedTypes: readonly Value[]): never {
// 	const v = result.print()
// 	const ord = orderedTypes.map(o => o.print()).join(', ')
// 	throw new Error(`Got '${v}' in order '${ord}'`)
// }

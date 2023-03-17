import {tryParse} from '..'
import {Value} from './value'

describe('value equality', () => {
	test('()')
	test('_')
	test('Never')
	test('0')
	test('"hello"')
	test('false')
	test('Number')
	test('[1 1]')
	test('[1 ...1]')
	test('{a: 10}')
	test('{a?: 10}')
	test('{...Number}')
	test('(=> [n:Number]: Number)')
	test('(union 1 2 3)')

	function test(input: string) {
		it(`${input} equals to itself`, () => {
			const value = tryParse(input).eval().result
			expect(value.isEqualTo(value)).toBe(true)
		})
	}
})

describe('subtyping', () => {
	// All, Never, Unit
	test('Never', 'Never', '=')
	test('Never', '_', '<')
	test('Never', '()', '<')
	test('Never', '0', '<')
	test('Never', 'Number', '<')
	test('0', '_', '<')
	test('Number', '_', '<')
	test('_', '_', '=')
	test('()', '()', '=')
	test('()', '0', '!=')
	test('()', '_', '<')

	// Prim, PrimType
	test('1', '1', '=')
	test('1', 'Number', '<')
	// run('1', Val.NumberType.extends('1'), true)
	test('"hello"', '"hello"', '=')
	test('"hello"', 'String', '<')
	test('String', 'Number', '!=')
	test('"hello"', 'Number', '!=')
	test('1', '_', '<')
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
	test('[...0]', '[...0]', '=')
	test('[...0]', '[...1]', '!=')
	test('[0 ...0]', '[...0]', '<')
	test('[...0]', '[]', '=')
	test('[0 ...0]', '[]', '<')
	test('[0 0]', '[...0]', '<')
	test('[0]', '[0?]', '<')
	test('[]', '[0?]', '=')
	test('[0?]', '[0?]', '=')
	test('[...0]', '[0? ...0]', '=')
	test('[...0]', '[0?]', '=')
	test('[0 0 0? ...0]', '[0 0?]', '<')
	test('[0 0 0? ...0]', '[0 0? ...0]', '<')

	// Dict
	test('{}', '{}', '=')
	test('{a:0}', '{a:_}', '<')
	test('{a:Never}', '{a:0}', '<')
	test('{a:0}', '{a:0}', '=')
	test('{a:0}', '{a:1}', '!=')
	test('{a:0 b:0}', '{a:0}', '<')
	test('{a:0}', '{a?:0}', '<')
	test('{a?:0}', '{a?:0}', '=')
	test('{}', '{a?:0}', '=')
	test('{a:0 b:0}', '{...0}', '<')
	test('{a:0 b:1}', '{...0}', '!=')
	test('{a?:0}', '{...0}', '=')
	test('{a?:0 ...1}', '{...0}', '!=')
	test('{a:0 ...0}', '{...0}', '<')
	test('{a?:0 ...0}', '{...0}', '=')

	// FnType
	test('(=> []: _)', '(=> []: _)', '=')
	test('(=> [x:_ y:_]: _)', '(=> [x:_ y:_ z:_ w:_]: _)', '<')
	test('(=> [x:(=> [x:_]: _)]: _)', '(=> [x:(=> [] _)]: _)', '<')
	test('(=> []: (=> []: _))', '(=> []: (=> [x:_]: _))', '<')

	test('(=> []: 0)', '(=> [x:_]: Number)', '<')
	test('(=> [x:Number]: _)', '(=> [x:0]: _)', '<')

	function test(xInput: string, yInput: string, expected: '<' | '=' | '!=') {
		it(`${xInput} ${expected} ${yInput}`, () => {
			const x = tryParse(xInput).eval().result
			const y = tryParse(yInput).eval().result

			const [x2y, y2x] =
				expected === '<'
					? [true, false]
					: expected === '='
					? [true, true]
					: [false, false]
			expect(x.isSubtypeOf(y)).toBe(x2y)
			expect(y.isSubtypeOf(x)).toBe(y2x)
		})
	}
})

describe('checking type or atom', () => {
	test('_', false)
	test('Never', true)
	test('()', false)
	test('0', false)
	test('"hello"', false)
	test('false', false)
	test('Number', true)
	test('Boolean', true)
	test('[]', false)
	test('[1 1]', false)
	test('[Number 1]', true)
	test('[[]]', false)
	test('[[1 2] [Number]]', true)
	test('[...1]', true)
	test('[...Number]', true)
	test('{}', false)
	test('{a:1}', false)
	test('{a:Number}', true)
	test('{a?:1}', true)
	test('{a?:Number}', true)
	test('{...0}', true)
	test('{...Number}', true)
	test('(=> []: _)', true)
	test('+', false)

	function test(input: string, isType: boolean) {
		it(input + ' is ' + (isType ? 'type' : 'an atom'), () => {
			const expr = tryParse(input).eval().result
			expect(expr.isType).toBe(isType)
		})
	}
})

describe('instance relationship', () => {
	test('_', '_')
	test('Never', '_')
	test('()', '()')
	test('Never', 'Never', false)
	test('0', '_')
	test('Number', '_')

	test('0', 'Number')
	test('"hello"', 'Number', false)

	test('[]', '[]')
	test('[1 2]', '[...Number]')
	test('[1 2 ...3]', '[...Number]', false)
	test('[Number Number]', '[...Number]', false)

	test('{}', '{}')
	test('{a:1 b:2}', '{...Number}')
	test('{a:1 ...2}', '{a:1 b:2}', false)
	test('{}', '{a?:Number}')
	test('{a:1}', '{a?:Number}')
	test('{a:1 b:"foo"}', '{...Number}', false)

	test('+', '(=> [x:Number y:Number]: Number)')
	test(
		'(=> [x:Number y:Number]: Number)',
		'(=> [x:Number y:Number]: Number)',
		false
	)

	function test(i: string, t: string, expected = true) {
		it(`${i} is ${expected ? '' : 'not '}a instance of ${t}`, () => {
			const iv = tryParse(i).infer().result
			const tv = tryParse(t).eval().result
			expect(iv.isSubtypeOf(tv)).toBe(expected)
		})
	}
})

describe('default values of types', () => {
	test('1', '1')
	test('Number', '0')
	test('String', '""')
	test('Boolean', 'false')
	test('(union 3 4)', '3')
	test('(union Number Boolean)', '0')
	test('(union Boolean Number)', 'false')
	test('()', '()')
	test('_', '()')
	test('Never', 'Never')

	test('[]', '[]')
	test('[Number String]', '[0 ""]')
	test('[...Number]', '[]')
	test('[Number ...Number]', '[0]')

	test('{}', '{}')
	test('{a:Number b:String}', '{a:0 b:""}')
	test('{a:Number b?:String}', '{a:0}')
	test('{...Number}', '{}')
	test('{a:Number ...String}', '{a:0}')
	test('{a?:Number ...String}', '{}')

	test('(=> []: Number)', '0', true)
	test('(=> [x:Number]: Boolean)', 'false', true)
	test('(=> (T) [t:T]: T)', '()', true)
	test('(=> [x:_]: ())', '()', true)

	test('^{default: PI} Number', 'PI')
	test('^{default: true} Boolean', 'true')
	test('^{default: "hello"} _', '"hello"')
	test('^{default: ()} ()', '()')
	test('^{} ()', '()')

	function test(input: string, expected: string, fn = false) {
		const eString = fn ? `(=> [] ${expected})` : expected

		it(`default value of '${input}' is '${eString}'`, () => {
			let dv: Value = tryParse(input).eval().result.defaultValue
			const ev = tryParse(expected).eval().result

			if (fn) {
				if (dv.type !== 'Fn') throw new Error('Got=' + dv.print())
				dv = dv.fn().result
			}

			if (!dv.isEqualTo(ev)) {
				throw new Error('Got=' + dv.print())
			}
		})
	}
})

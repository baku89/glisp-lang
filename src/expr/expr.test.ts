import {parse, testEval} from '../util/TestUtil'
import {
	all,
	dict,
	False,
	fnType,
	never,
	number as num,
	NumberType,
	string as str,
	StringType,
	True,
	unit,
	vec,
} from '../value'

describe('evaluating literals', () => {
	testEval('_', all)
	testEval('Never', never)
	testEval('()', unit)
	testEval('0', num(0))
	testEval('"foo"', str('foo'))
	testEval('true', True)
	testEval('false', False)

	testEval('[]', vec())
	testEval('[0]', vec([num(0)]))
	testEval('[...Number]', vec([], undefined, NumberType))
	testEval('[1 ...Number]', vec([num(1)], undefined, NumberType))
	testEval('[0]', vec([num(0)]))
	testEval('{a:1 b:2}', dict({a: num(1), b: num(2)}))
	testEval('{a?:Number ...String}', dict({a: NumberType}, ['a'], StringType))
	testEval('(=> [x:Number]: String)', fnType({x: NumberType}, StringType))
	testEval('(let a: 10 a)', num(10))
	testEval('(let a: (let a: 20 a) a)', num(20))
})

describe('evaluating function definition', () => {
	testEval('((=> [] 5))', '5')
	testEval('((=> [x:Number] x) 1)', '1')
	testEval('((=> [x:Number] (+ x 1)) 10)', '11')
	testEval(
		`
(let add: (=> [x:Number] (=> [y:Number] (+ x y)))
     ((add 2) 3))
`,
		'5'
	)
	testEval(
		`
(let f: (=> [x:Number] (let x: 20 x))
     (f 5))
`,
		'20'
	)
	testEval(
		`
(let f: (=> [x:Number]
            (let x: 100
                 (=> [y:Number] (+ x y))))
     ((f 2) 3))
`,
		'103'
	)
	testEval('((=> [f:(=> [x:Number]: Number)] (f 1)) id)', '1')
})

describe('run-time error handling', () => {
	testEval('(try ([] 0) 1)', '1', true)
})

describe('resolving identifier', () => {
	testEval('(let X: Number (=> [a:X]: X))', '(=> [a:Number]: Number)')
})

describe('inferring expression type', () => {
	test('_', '_')
	test('Never', '_')
	test('()', '()')
	test('0', '0')
	test('"foo"', '"foo"')
	test('true', 'true')

	test('Number', '_')
	test('Boolean', '_')

	test('[]', '[]')
	test('[0 1]', '[0 1]')
	test('[Number]', '[_]')
	test('[...0]', '_')

	test('{}', '{}')
	test('{a:0}', '{a:0}')
	test('{a:Number}', '{a:_}')
	test('{a?:0}', '_')
	test('{...0}', '_')
	test('{a: Number}', '{a: _}')
	test('{a: (+ 1 2)}', '{a: Number}')

	test('(+ 1 2)', 'Number')
	test('[(+ 1 2)]', '[Number]')

	test('(=> [] 5)', '(=> []: 5)')
	test('(=> [x:Number] "foo")', '(=> [x:Number]: "foo")')
	test('(=> [x:Number] x)', '(=> [x:Number]: Number)')
	test('(=> [x:(+ 1 2)] (+ x 4))', '(=> [x:3]: Number)')
	test('(=> [x:_] Number)', '(=> [x:_]: _)')

	test('(=> [x:Number]: Number)', '_')

	test('(let a: Number a)', '_')
	test('(let a: 10)', '()')
	test('(let a: (+ 1 2) b: a b)', 'Number')

	test('((=> (T) [x:T] x) 4)', '4')
	test('((=> (T) [x:T] x) (+ 1 2))', 'Number')
	test('((=> (T) [f:(=> [t:T]: T)] f) inc)', '(=> [t:Number]: Number)')
	test(
		'((=> (T) [f:(=> [t:T]: T)] (=> [x:T] (f x))) inc)',
		'(=> [t:Number]: Number)'
	)
	test('(try 1 2)', '(union 1 2)')

	function test(input: string, expected: string) {
		it(`${input} is inferred to be ${expected}`, () => {
			const i = parse(input).infer()
			const e = parse(expected).eval().result

			if (!i.isEqualTo(e)) throw new Error('Got=' + i.print())
		})
	}
})

describe('evaluating function body', () => {
	test('(=> [x:Number] x)', '0')
	test('(=> [x:Number] (+ x 10))', '10')
	test('(=> [x:Boolean] x)', 'false')
	test('(=> (T) [x:T] x)', '()')

	function test(input: string, expected: string) {
		it(`body of ${input} should evaluate to ${expected}`, () => {
			const i = parse(input)
			const e = parse(expected).eval().result

			if (i.type !== 'FnDef')
				throw new Error('Not a function. Got=' + i.print())

			if (!i.body)
				throw new Error('Not a function definition. Got=' + i.print())

			const result = i.body.eval().result

			if (!result.isEqualTo(e)) throw new Error('Got=' + result.print())
		})
	}
})

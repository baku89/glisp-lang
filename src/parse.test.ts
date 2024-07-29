import {describe, expect, test} from 'vitest'

import {Current, dict, list, Parent, s, Sym, vector} from './ast'
import {__, parse} from './parse'
import {print} from './print'

describe('parsing delimiter', () => {
	test('delimiter cannot be empty string', () => {
		expect(() => __.tryParse('')).toThrow()
	})

	test('" " can be a delimiter', () => {
		expect(() => __.tryParse(' ')).not.toThrow()
	})

	test('"\t" can be a delimiter', () => {
		expect(() => __.tryParse('\t')).not.toThrow()
	})

	test('"\n" can be a delimiter', () => {
		expect(() => __.tryParse('\n')).not.toThrow()
	})

	test('"\r" can be a delimiter', () => {
		expect(() => __.tryParse('\r')).not.toThrow()
	})

	test('"\r\n" can be a delimiter', () => {
		expect(() => __.tryParse('\r\n')).not.toThrow()
	})

	test('"  \t \n \r\n  " can be a delimiter', () => {
		expect(() => __.tryParse('  \t \n \r\n  ')).not.toThrow()
	})

	test('"not a delimiter" cannot be a delimiter', () => {
		expect(() => __.tryParse('not a delimiter')).toThrow()
	})

	test('"//comment" can be a delimiter', () => {
		expect(() => __.tryParse('//comment')).not.toThrow()
	})

	test('"//comment\n" can be a delimiter', () => {
		expect(() => __.tryParse('//comment\n')).not.toThrow()
	})

	test('"\n//comment" can be a delimiter', () => {
		expect(() => __.tryParse('\n//comment')).not.toThrow()
	})

	test('"\n//comment\n" can be a delimiter', () => {
		expect(() => __.tryParse('\n//comment\n')).not.toThrow()
	})

	test('"//comment\nnot a comment" cannot be a delimiter', () => {
		expect(() => __.tryParse('\n not a comment')).toThrow()
	})
})

describe('parsing literals', () => {
	testParsing('10', 10)
	testParsing('Infinity', Infinity)
	testParsing('-Infinity', -Infinity)
	testParsing('NaN', NaN)
	testParsing('   10   ', 10)
	testParsing('   \t 5 \r\n', 5)

	testParsing('-10', -10)
	testParsing('.1', 0.1)
	testParsing('+.2', 0.2)
	testParsing('5.', 5)
	testParsing('0.5', 0.5)
	testParsing('-0.', -0)
	testParsing('003', 3)
	testParsing('Infinity', Infinity)
	testParsing('-Infinity', -Infinity)
	testParsing('NaN', NaN)

	testErrorParsing('-.')
	testErrorParsing('0..2')

	testParsing('"hello"', 'hello')
	testParsing('"hello, world"', 'hello, world')
})

describe('parsing symbols', () => {
	testParsing('a', s`a`)
	testParsing('$', s`$`)
	testParsing('false', s`false`)
	testParsing('true', s`true`)
	testParsing('foo', s`foo`)
	testParsing('BAR', s`BAR`)
	testParsing('true1', s`true1`)
	testParsing('a12', s`a12`)
	testParsing('abc12', s`abc12`)
	testParsing('+-*&|<=>_', s`+-*&|<=>_`)
	testParsing('変数', s`変数`)
	testParsing('🍡', s`🍡`)
	testParsing('_', s`_`)
	testParsing('->', s`->`)
	testParsing('try', s`try`)

	testErrorParsing('10deg')
	testErrorParsing('10 20')
	testErrorParsing('/')
	testErrorParsing('@')
	testErrorParsing('=>')
	testErrorParsing('baku?')

	testParsing('./x', new Sym([Current, 'x']))
	testParsing('x/y', new Sym(['x', 'y']))
	testParsing('x/.', new Sym(['x', Current]))
	testParsing('../x', new Sym([Parent, 'x']))
	testParsing('x/..', new Sym(['x', Parent]))
	testParsing('./0', new Sym([Current, 0]))
	testParsing('x/111/222', new Sym(['x', 111, 222]))
	testParsing('x.x', new Sym(['x'], ['x']))
	testParsing('x.0', new Sym(['x'], [0]))
	testParsing('x/y.0.z.2', new Sym(['x', 'y'], [0, 'z', 2]))
})

describe('parsing line comment', () => {
	testParsing('1//comment', 1)
	testParsing('1////', 1)
	testParsing('///\n1////', 1)
	testParsing('//\n1', 1)
	testParsing('1//comment//comment', 1)
	testParsing(' //comment\n 1 // comment', 1)
	testParsing('//comment\n1', 1)
	testParsing('1//comment\n\n', 1)
	testParsing('1//comment\n//comment\n', 1)
	testParsing('//comment\n//comment\n1', 1)
	testParsing('//\n//\n1', 1)
	testParsing('(//comment)\n1//comment)\n)', list(1))
	testParsing('(//comment\n1 2	3  \n4    )', list(1, 2, 3, 4))
})

describe('parsing app expressions', () => {
	testParsing(' () ', list())
	testParsing('( )', list())
	testParsing(' (  \t   ) ', list())
	testParsing(' ( 0 1 2 ) ', list(0, 1, 2))
	testParsing('(+ 1 2)', list(s`+`, 1, 2))
	testParsing('(* 1 2)', list(s`*`, 1, 2))
	testParsing('(( ) 2 ( ))', list(list(), 2, list()))
	testParsing('(x ***)', list(s`x`, s`***`))
	testParsing('(x ())', list(s`x`, list()))
	testParsing('(x)', list(s`x`))
	testParsing('(0 false)', list(0, s`false`))
	testParsing('((true) x)', list(list(s`true`), s`x`))

	testErrorParsing('(()())')
})

// describe('parsing infix literals', () => {
// 	testParsing('50%', infix('%', 50))
// 	testParsing('-1.%', infix('%', -1))
// 	testParsing('.01%', infix('%', 0.01))
// 	testParsing('2.3e5', infix('e', 2.3, 5))
// 	testParsing('2.3e-2', infix('e', 2.3, -2))
// 	testParsing('2.3e.1', infix('e', 2.3, 0.1))
// 	testParsing('3V2V1', infix('V', 3, 2, 1))
// 	testErrorParsing('3V2V')
// })

// describe('parsing scope', () => {
// 	testParsing('(let)', scope())
// 	testParsing('(let 10)', scope({}, 10))
// 	testParsing('(let x: 1 x)', scope({x: 1}, x))
// 	testParsing('(let x: 1)', scope({x: 1}))
// 	testParsing('(let x: (let x: 1))', scope({x: scope({x: 1})}))
// 	testParsing('(let (let 1))', scope({}, scope({}, 1)))
// 	testParsing('(let x:[] y:[] z)', scope({x: vec(), y: vec()}, symbol('z')))

// 	testParsing('(let+ 20)', list(symbol('let+'), 20))

// 	testErrorParsing('(let==: 10)')
// })

// describe('parsing match', () => {
// 	testParsing('(match x: x)', match('x', symbol('x')))
// 	testParsing(
// 		'(match x: y 0: "a")',
// 		match('x', symbol('y'), [[0, 'a']])
// 	)
// 	testParsing(
// 		'(match x: y 0: "a" _)',
// 		match('x', symbol('y'), [[0, 'a']], symbol('_'))
// 	)
// 	testParsing(
// 		'(match x: y 0:"a" 1:"b"  _)',
// 		match(
// 			'x',
// 			symbol('y'),
// 			[
// 				[0, 'a'],
// 				[1, 'b'],
// 			],
// 			symbol('_')
// 		)
// 	)
// 	testParsing('(match x: y "a")', match('x', symbol('y'), [], 'a'))
// })

describe('parsing vector', () => {
	testParsing('[]', vector())
	testParsing('[   ]', vector())
	testParsing('[    1  ]', vector(1))
	testParsing('[1 2 3]', vector(1, 2, 3))
	testParsing('[1 [2] 3]', vector(1, vector(2), 3))
	testParsing(
		'[(+) false (+) +]',
		vector(list(s`+`), s`false`, list(s`+`), s`+`)
	)
	// testParsing('[...1]', vector([], 0, 1))
	// testParsing('[?1]', vector([1], 0))
	// testParsing('[?1 ...2]', vector([1], 0, 2))
	// testParsing('[1 ?2]', vector([1, 2], 1))
	// testParsing('[1 ?2 ?3 ...4]', vector([1, 2, 3], 1, 4))

	// 	testErrorParsing('[[][]]')
	// 	testErrorParsing('[1[]2]')
	// 	testErrorParsing('[?1 2]')
	// 	testErrorParsing('[?1 2 ?3 ?4]')
})

describe('parsing dictionary', () => {
	testParsing('{}', dict())
	testParsing('{   }', dict())
	testParsing('{   a:    1 }', dict(['a', 1]))
	testParsing('{\tfoo_bar: 1\t}', dict(['foo_bar', 1]))

	testParsing('{a: A b: B}', dict(['a', s`A`], ['b', s`B`]))
	testParsing('{a: {a: 1}}', dict(['a', dict(['a', 1])]))
	// 	testParsing('{?a:1}', dict({a: 1}, ['a']))
	// 	testParsing(
	// 		'{?a:1 b:2 ...c}',
	// 		dict(
	// 			{
	// 				a: 1,
	// 				b: 2,
	// 			},
	// 			['a'],
	// 			symbol('c')
	// 		)
	// 	)

	testErrorParsing('{"a": 0}')
	testErrorParsing('{a:[]b:0}')
})

// describe('parsing parameters in function definition', () => {
// 	testParsing('[]', paramsDef())
// 	testParsing('[x: Number]', paramsDef({x: Number}))
// 	testParsing('[x:Number]', paramsDef({x: Number}))
// 	testParsing('[\nx:\n Number\n]', paramsDef({x: Number}))
// 	testParsing('[x: Number y:Boolean]', paramsDef({x: Number, y: Boolean}))
// 	testParsing('[...xs:Number]', paramsDef({}, null, {name: 'xs', expr: Number}))
// 	testParsing(
// 		'[...xs:  Number ]',
// 		paramsDef({}, null, {name: 'xs', expr: Number})
// 	)
// 	testParsing(
// 		'[x:Number...xs:Number]',
// 		paramsDef({x: Number}, null, {name: 'xs', expr: Number})
// 	)

// 	function testParsing(input: string, expected: ParamsDef) {
// 		it(`parsing ${input} to be ${expected.print()}`, () => {
// 			Parser.ParamsDef.tryParse(input).isSameTo(expected)
// 		})
// 	}
// })

// describe('parsing function definition', () => {
// 	testParsing('(=> [x:Number] x)', fnDef(null, {x: Number}, null, x))
// 	testParsing('(=> [ x: Number ] x)', fnDef(null, {x: Number}, null, x))
// 	testParsing(
// 		'(=> [x: Number y: Boolean] x)',
// 		fnDef(null, {x: Number, y: Boolean}, null, x)
// 	)
// 	testParsing('(=> [] _)', fnDef(null, {}, null, all))
// 	testParsing('(=> [] _)', fnDef(null, {}, null, all))
// 	testParsing('(=> () [] _)', fnDef([], {}, null, all))
// 	testParsing('(=> [] ())', fnDef(null, {}, null, list()))
// 	testParsing(
// 		'(=> [] (+ 1 2))',
// 		fnDef(null, {}, null, list(symbol('+'), 1, 2))
// 	)
// 	testParsing(
// 		'(=> [] (=> [] 1))',
// 		fnDef(null, {}, null, fnDef(null, {}, null, 1))
// 	)

// 	// Polymorphic functions
// 	testParsing('(=> (T) [x:T] x)', fnDef(['T'], {x: symbol('T')}, null, x))
// 	testParsing(
// 		'(=> (T U) [x:T] x)',
// 		fnDef(['T', 'U'], {x: symbol('T')}, null, x)
// 	)
// 	testParsing('(=> () [] Number)', fnDef([], {}, null, Number))

// 	// functions with rest parameter
// 	testParsing(
// 		'(=> [...x:x] y)',
// 		fnDef(null, paramsDef({}, 0, {name: 'x', expr: x}), null, y)
// 	)
// 	testParsing(
// 		'(=> [x:x ...y:y] z)',
// 		fnDef(null, paramsDef({x}, 1, {name: 'y', expr: y}), null, z)
// 	)
// })

// describe('parsing function type', () => {
// 	testParsing('(=> []: x)', fnDef(null, {}, x))
// 	testParsing('(=> [x:_]: _)', fnDef(null, {x: all}, all))
// 	testParsing('(=> [a:[...x]]: x)', fnDef(null, {a: vec([], 0, x)}, x))
// 	testParsing('(=> [x:[]]: ())', fnDef(null, {x: vec()}, list()))
// 	testParsing('(=> []: z)', fnDef(null, {}, z))
// 	testParsing('(=> []:z)', fnDef(null, {}, z))
// 	testParsing('(=> () []:z)', fnDef([], {}, z))
// 	testParsing('(\n=> []:z\n)', fnDef(null, {}, z))
// 	testParsing('(=> []: [])', fnDef(null, {}, vec()))
// 	testParsing('(=> [x:x]: z)', fnDef(null, {x}, z))

// 	testParsing('(=> [x:x y:y]: z)', fnDef(null, {x, y}, z))
// 	testParsing('(=> [x:x y:y z:z]: w)', fnDef(null, {x, y, z}, w))
// 	testParsing('(=> [a:[x y]]: z)', fnDef(null, {a: vec([x, y])}, z))
// 	testParsing('(=> [x:x]: z)', fnDef(null, {x}, z))
// 	testParsing('(=> [x:x y:y]: z)', fnDef(null, {x, y}, z))
// 	testParsing('(=> (T) [x:T]: T)', fnDef(['T'], {x: symbol('T')}, symbol('T')))
// 	testParsing(
// 		'(=> (T U) [x:T]: T)',
// 		fnDef(['T', 'U'], {x: symbol('T')}, symbol('T'))
// 	)
// 	testParsing('(=> [?x:x]: y)', fnDef(null, paramsDef({x}, 0), y))
// 	testParsing('(=> [?x:x]: y)', fnDef(null, paramsDef({x}, 0), y))
// 	testParsing('(=> [?x:x]: y)', fnDef(null, paramsDef({x}, 0), y))
// 	testParsing('(=> [x:x ?y:y]: z)', fnDef(null, paramsDef({x, y}, 1), z))
// })

// describe('parsing value metadata', () => {
// 	testParsing('^metadata 0', valueMeta(symbol('metadata'), 0))
// 	testParsing('^{}0', valueMeta(dict(), 0))
// 	testParsing(
// 		'^\t{default: 0}\n0',
// 		valueMeta(dict({default: 0}), 0)
// 	)
// 	testParsing('^{}()', valueMeta(dict(), list()))

// 	testParsing(
// 		'^{default: true} Boolean',
// 		valueMeta(dict({default: symbol('true')}), symbol('Boolean'))
// 	)

// 	testParsing(
// 		'^{default: 0} ^{default: 1} Number',
// 		valueMeta(
// 			dict({default: 0}),
// 			valueMeta(dict({default: 1}), symbol('Number'))
// 		)
// 	)

// 	testParsing(
// 		'^^{a: 1} {b: 2} T',
// 		valueMeta(
// 			valueMeta(dict({a: 1}), dict({b: 2})),
// 			symbol('T')
// 		)
// 	)

// 	testErrorParsing('Boolean^true')
// 	testErrorParsing('^{true}Boolean')
// })

// describe('parsing type signature', () => {
// 	testParsing('0::Number', new TypeSignature(0, symbol('Number')))
// 	testParsing('0\n::\tNumber', new TypeSignature(0, symbol('Number')))

// 	testErrorParsing('0 :: Number :: String')
// })

// /*
// describe('parsing expression metadata', () => {
// 	// testParsing('layer#{}', symbol('layer').setNodeMeta(new NodeMeta(dict())))
// 	// testParsing(
// 	// 	'layer#{collapsed: true}',
// 	// 	symbol('layer').setNodeMeta(new NodeMeta(dict({collapsed: symbol('true')})))
// 	// )
// 	// testParsing(
// 	// 	'^{default: 0 label: "literalber"} Number#{prop: "A"}',
// 	// 	symbol('Number')
// 	// 		.setValueMeta(new ValueMeta(0, dict({label: 'literalber'})))
// 	// 		.setNodeMeta(new NodeMeta(dict({prop: 'A'})))
// 	// )
// 	// testErrorParsing('layer#{}#{}')
// 	// testErrorParsing('Number#{}^0')
// })
// */

function testParsing(input: string, expected: any) {
	test(`parsing '${input}' to be ${print(expected)}`, () => {
		expect(parse(input)).toStrictEqual(expected)
	})
}

function testErrorParsing(input: string) {
	test(`parsing '${input}' throws an error`, () => {
		expect(() => {
			parse(input)
		}).toThrow()
	})
}

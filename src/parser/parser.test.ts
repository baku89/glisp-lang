import {
	app,
	dictLiteral as dict,
	Expr,
	fnDef,
	literal,
	match,
	ParamsDef,
	paramsDef,
	scope,
	symbol,
	valueMeta,
	vecLiteral as vec,
} from '../expr'
import {parse} from '.'
import {Parser} from '.'

const all = symbol('_')

const Number = symbol('Number')
const Boolean = symbol('Boolean')
const x = symbol('x')
const y = symbol('y')
const z = symbol('z')
const w = symbol('w')

describe('parsing literals', () => {
	testParsing('10', literal(10))
	testParsing('   10   ', literal(10))
	testParsing('   \t 5 \r\n', literal(5))

	testParsing('-10', literal(-10))
	testParsing('.1', literal(0.1))
	testParsing('+.2', literal(0.2))
	testParsing('5.', literal(5))
	testParsing('0.5', literal(0.5))
	testParsing('-0.', literal(0))
	testParsing('003', literal(3))
	testParsing('Infinity', literal(Infinity))
	testParsing('-Infinity', literal(-Infinity))
	testParsing('NaN', literal(NaN))

	testErrorParsing('-.')
	testErrorParsing('0..2')

	testParsing('"hello"', literal('hello'))
	testParsing('"hello, world"', literal('hello, world'))
})

describe('parsing symbols', () => {
	testParsing('a', 'a')
	testParsing('$', '$')
	testParsing('false', 'false')
	testParsing('true', 'true')
	testParsing('foo', 'foo')
	testParsing('BAR', 'BAR')
	testParsing('true1', 'true1')
	testParsing('a12', 'a12')
	testParsing('abc12', 'abc12')
	testParsing('+-*&|<=>_', '+-*&|<=>_')
	testParsing('変数', '変数')
	testParsing('🍡', '🍡')
	testParsing('`_`', '_')
	testParsing('->', '->')
	testParsing('try', 'try')

	testErrorParsing('symbol?')
	testErrorParsing('10deg')
	testErrorParsing('10 20')
	testErrorParsing('/')
	testErrorParsing('@')
	testErrorParsing('=>')
	testErrorParsing('let')
	testErrorParsing(';')
	testErrorParsing('Infinity')
	testErrorParsing('-Infinity')
	testErrorParsing('NaN')

	function testParsing(input: string, name: string) {
		it(`parsing ${input} to be a symbol with name '${name}'`, () => {
			Parser.Symbol.tryParse(input).isSameTo(symbol(name))
		})
	}

	function testErrorParsing(input: string) {
		it(`parsing ${input} throws an error`, () => {
			expect(() => {
				const parsed = Parser.Symbol.tryParse(input)
				// eslint-disable-next-line no-console
				console.log(parsed)
			}).toThrow()
		})
	}
})

describe('parsing path symbols', () => {
	testParsing('./x', symbol('.', 'x'))
	testParsing('x/y', symbol('x', 'y'))
	testParsing('x/.', symbol('x', '.'))
	testParsing('../x', symbol('..', 'x'))
	testParsing('x/..', symbol('x', '..'))
	testParsing('./0', symbol('.', 0))
	testParsing('x/111/222', symbol('x', 111, 222))
})

describe('parsing line comment', () => {
	testParsing('1;comment', literal(1))
	testParsing('1;;;;', literal(1))
	testParsing(';;;\n1;;;;', literal(1))
	testParsing(';;\n1', literal(1))
	testParsing('1;comment;comment', literal(1))
	testParsing(' ;comment\n 1 ; comment', literal(1))
	testParsing(';comment\n1', literal(1))
	testParsing('1;comment\n\n', literal(1))
	testParsing('1;comment\n;comment\n', literal(1))
	testParsing(';comment\n;comment\n1', literal(1))
	testParsing(';\n;\n1', literal(1))
	testParsing('(;comment)\n1;comment)\n)', app(literal(1)))
})

describe('parsing app expressions', () => {
	testParsing(' () ', app())
	testParsing(' (  \t   ) ', app())
	testParsing(' ( 0 1 2 ) ', app(literal(0), literal(1), literal(2)))
	testParsing('(+ 1 2)', app(symbol('+'), literal(1), literal(2)))
	testParsing('(* 1 2)', app(symbol('*'), literal(1), literal(2)))
	testParsing('(()2())', app(app(), literal(2), app()))
	testParsing('(x _)', app(x, all))
	testParsing('(x ())', app(x, app()))
	testParsing('(x)', app(x))
	testParsing('(0 false)', app(literal(1), symbol('false')))
	testParsing('((true) x)', app(app(symbol('true')), x))
})

describe('parsing scope', () => {
	testParsing('(let)', scope())
	testParsing('(let 10)', scope({}, literal(10)))
	testParsing('(let x: 1 x)', scope({x: literal(1)}, x))
	testParsing('(let x: 1)', scope({x: literal(1)}))
	testParsing('(let x: (let x: 1))', scope({x: scope({x: literal(1)})}))
	testParsing('(let (let 1))', scope({}, scope({}, literal(1))))
	testParsing('(let x:[]y:[]z)', scope({x: vec(), y: vec()}, symbol('z')))

	testParsing('(let+ 20)', app(symbol('let+'), literal(20)))

	testErrorParsing('(let==: 10)')
})

describe('parsing match', () => {
	testParsing('(match x: x)', match('x', symbol('x')))
	testParsing(
		'(match x: y 0: "a")',
		match('x', symbol('y'), [[literal(0), literal('a')]])
	)
	testParsing(
		'(match x: y 0: "a" _)',
		match('x', symbol('y'), [[literal(0), literal('a')]], symbol('_'))
	)
	testParsing(
		'(match x: y 0:"a" 1:"b"  _)',
		match(
			'x',
			symbol('y'),
			[
				[literal(0), literal('a')],
				[literal(1), literal('b')],
			],
			symbol('_')
		)
	)
	testParsing('(match x: y "a")', match('x', symbol('y'), [], literal('a')))
})

describe('parsing vector', () => {
	testParsing('[]', vec())
	testParsing('[   ]', vec())
	testParsing('[    1  ]', vec([literal(1)]))
	testParsing('[1 2 3]', vec([literal(1), literal(2), literal(3)]))
	testParsing('[1 [2] 3]', vec([literal(1), vec([literal(2)]), literal(3)]))
	testParsing('[1[2] 3]', vec([literal(1), vec([literal(2)]), literal(3)]))
	testParsing(
		'[(+) false (+) +]',
		vec([app(symbol('+')), symbol('false'), app(symbol('+')), symbol('+')])
	)
	testParsing('[...1]', vec([], 0, literal(1)))
	testParsing('[1?]', vec([literal(1)], 0))
	testParsing('[1? ...2]', vec([literal(1)], 0, literal(2)))
	testParsing('[1 2?]', vec([literal(1), literal(2)], 1))
	testParsing(
		'[1 2? 3? ...4]',
		vec([literal(1), literal(2), literal(3)], 1, literal(4))
	)

	testErrorParsing('[1? 2]')
	testErrorParsing('[1? 2 3? 4?]')
})

describe('parsing dictionary', () => {
	testParsing('{   a:    1 }', dict({a: literal(1)}))
	testParsing('{\tfoo_bar: 1\t}', dict({foo_bar: literal(1)}))
	testParsing('{   }', dict({}))
	testParsing('{a: A b: B}', dict({a: symbol('A'), b: symbol('B')}))
	testParsing('{a: {a: 1}}', dict({a: dict({a: literal(1)})}))
	testParsing('{a?:1}', dict({a: literal(1)}, ['a']))
	testParsing(
		'{a?:1 b:2 ...c}',
		dict(
			{
				a: literal(1),
				b: literal(2),
			},
			['a'],
			symbol('c')
		)
	)

	testErrorParsing('{"a": 0}')
})

describe('parsing parameters in function definition', () => {
	testParsing('[]', paramsDef())
	testParsing('[x: Number]', paramsDef({x: Number}))
	testParsing('[x:Number]', paramsDef({x: Number}))
	testParsing('[\nx:\n Number\n]', paramsDef({x: Number}))
	testParsing('[x: Number y:Boolean]', paramsDef({x: Number, y: Boolean}))
	testParsing('[...xs:Number]', paramsDef({}, null, {name: 'xs', expr: Number}))
	testParsing(
		'[...xs:  Number ]',
		paramsDef({}, null, {name: 'xs', expr: Number})
	)
	testParsing(
		'[x:Number...xs:Number]',
		paramsDef({x: Number}, null, {name: 'xs', expr: Number})
	)

	function testParsing(input: string, expected: ParamsDef) {
		it(`parsing ${input} to be ${expected.print()}`, () => {
			Parser.ParamsDef.tryParse(input).isSameTo(expected)
		})
	}
})

describe('parsing function definition', () => {
	testParsing('(=> [x:Number] x)', fnDef(null, {x: Number}, null, x))
	testParsing('(=> [ x: Number ] x)', fnDef(null, {x: Number}, null, x))
	testParsing(
		'(=> [x: Number y: Boolean] x)',
		fnDef(null, {x: Number, y: Boolean}, null, x)
	)
	testParsing('(=> [] _)', fnDef(null, {}, null, all))
	testParsing('(=>[]_)', fnDef(null, {}, null, all))
	testParsing('(=>()[]_)', fnDef([], {}, null, all))
	testParsing('(=> [] ())', fnDef(null, {}, null, app()))
	testParsing(
		'(=> [] (+ 1 2))',
		fnDef(null, {}, null, app(symbol('+'), literal(1), literal(2)))
	)
	testParsing(
		'(=> [] (=> [] 1))',
		fnDef(null, {}, null, fnDef(null, {}, null, literal(1)))
	)

	// Polymorphic functions
	testParsing('(=> (T) [x:T] x)', fnDef(['T'], {x: symbol('T')}, null, x))
	testParsing(
		'(=> (T U) [x:T] x)',
		fnDef(['T', 'U'], {x: symbol('T')}, null, x)
	)
	testParsing('(=> () [] Number)', fnDef([], {}, null, Number))

	// functions with rest parameter
	testParsing(
		'(=> [...x:x] y)',
		fnDef(null, paramsDef({}, 0, {name: 'x', expr: x}), null, y)
	)
	testParsing(
		'(=> [x:x ...y:y] z)',
		fnDef(null, paramsDef({x}, 1, {name: 'y', expr: y}), null, z)
	)
})

describe('parsing function type', () => {
	testParsing('(=> []: x)', fnDef(null, {}, x))
	testParsing('(=> [x:_]: _)', fnDef(null, {x: all}, all))
	testParsing('(=> [a:[...x]]: x)', fnDef(null, {a: vec([], 0, x)}, x))
	testParsing('(=> [x:[]]: ())', fnDef(null, {x: vec()}, app()))
	testParsing('(=> []: z)', fnDef(null, {}, z))
	testParsing('(=>[]:z)', fnDef(null, {}, z))
	testParsing('(=>()[]:z)', fnDef([], {}, z))
	testParsing('(\n=>[]:z\n)', fnDef(null, {}, z))
	testParsing('(=> []: [])', fnDef(null, {}, vec()))
	testParsing('(=> [x:x]: z)', fnDef(null, {x}, z))

	testParsing('(=> [x:x y:y]: z)', fnDef(null, {x, y}, z))
	testParsing('(=> [x:x y:y z:z]: w)', fnDef(null, {x, y, z}, w))
	testParsing('(=> [a:[x y]]: z)', fnDef(null, {a: vec([x, y])}, z))
	testParsing('(=> [x:x]: z)', fnDef(null, {x}, z))
	testParsing('(=> [x:x y:y]: z)', fnDef(null, {x, y}, z))
	testParsing('(=> (T) [x:T]: T)', fnDef(['T'], {x: symbol('T')}, symbol('T')))
	testParsing(
		'(=> (T U) [x:T]: T)',
		fnDef(['T', 'U'], {x: symbol('T')}, symbol('T'))
	)
	testParsing('(=> [x?:x]: y)', fnDef(null, paramsDef({x}, 0), y))
	testParsing('(=> [x?:x]: y)', fnDef(null, paramsDef({x}, 0), y))
	testParsing('(=> [x?:x]: y)', fnDef(null, paramsDef({x}, 0), y))
	testParsing('(=> [x:x y?:y]: z)', fnDef(null, paramsDef({x, y}, 1), z))
})

describe('parsing value metadata', () => {
	testParsing('^metadata 0', valueMeta(symbol('metadata'), literal(0)))
	testParsing('^{}0', valueMeta(dict(), literal(0)))
	testParsing(
		'^\t{default: 0}\n0',
		valueMeta(dict({default: literal(0)}), literal(0))
	)
	testParsing('^{}()', valueMeta(dict(), app()))

	testParsing(
		'^{default: true} Boolean',
		valueMeta(dict({default: symbol('true')}), symbol('Boolean'))
	)

	testParsing(
		'^{default: 0} ^{default: 1} Number',
		valueMeta(
			dict({default: literal(0)}),
			valueMeta(dict({default: literal(1)}), symbol('Number'))
		)
	)

	testParsing(
		'^^{a: 1} {b: 2} T',
		valueMeta(
			valueMeta(dict({a: literal(1)}), dict({b: literal(2)})),
			symbol('T')
		)
	)

	testErrorParsing('Boolean^true')
	testErrorParsing('^{true}Boolean')
})

/*
describe('parsing expression metadata', () => {
	// testParsing('layer#{}', symbol('layer').setNodeMeta(new NodeMeta(dict())))
	// testParsing(
	// 	'layer#{collapsed: true}',
	// 	symbol('layer').setNodeMeta(new NodeMeta(dict({collapsed: symbol('true')})))
	// )
	// testParsing(
	// 	'^{default: 0 label: "literalber"} Number#{prop: "A"}',
	// 	symbol('Number')
	// 		.setValueMeta(new ValueMeta(literal(0), dict({label: literal('literalber')})))
	// 		.setNodeMeta(new NodeMeta(dict({prop: literal('A')})))
	// )
	// testErrorParsing('layer#{}#{}')
	// testErrorParsing('Number#{}^0')
})
*/

function testParsing(input: string, expected: Expr) {
	test(`parsing '${input}' to be ${expected.print()}`, () => {
		let result = parse(input)
		if (!result.expr) throw new Error('Empty program')
		const {expr} = result

		if (!expr.isSameTo(expected)) {
			throw new Error(
				'Not as same as expected, got=' +
					expr.print() +
					' with type ' +
					expr.type
			)
		}

		if (result.print() !== input) {
			throw new Error(`Doesn't store CST properly, got='${result.print()}'`)
		}
	})
}

function testErrorParsing(input: string) {
	test(`parsing '${input}' throws an error`, () => {
		expect(() => {
			const parsed = parse(input)
			// eslint-disable-next-line no-console
			console.log(parsed)
		}).toThrow()
	})
}

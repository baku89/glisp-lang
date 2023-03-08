import {
	app,
	dict,
	Expr,
	fnDef,
	fnType,
	id,
	isSame,
	num,
	paramsDef,
	scope,
	str,
	tryCatch,
	valueMeta,
	vec,
} from '../expr'
import {parse} from '.'

const all = id('_')
const never = id('Never')

const Num = id('Num')
const Bool = id('Bool')
const x = id('x')
const y = id('y')
const z = id('z')
const w = id('w')

describe('parsing literals', () => {
	testParsing('10', num(10))
	testParsing('   10   ', num(10))
	testParsing('   \t 5 \r\n', num(5))
	testParsing('false', id('false'))
	testParsing('true', id('true'))
	testParsing('"hello"', str('hello'))
	testParsing('"hello, world"', str('hello, world'))
	testParsing(' () ', app())
	testParsing(' (  \t   ) ', app())
	testParsing(' _ ', all)
	testParsing('Never', never)
})

describe('parsing symbols', () => {
	run('foo', 'foo')
	run('BAR', 'BAR')
	run('true1', 'true1')
	run('abc123 ', 'abc123')
	run('+-*&|<=>_', '+-*&|<=>_')
	run('変数', '変数')
	run('🍡', '🍡')
	// run('`a symbol with spaces`', 'a symbol with spaces')
	// run('`    `', '    ')
	// run('`_`', '_')
	// run('`( )`', '( )')
	run('symbol?', null)
	run('10deg', null)
	run('->', null)

	function run(input: string, expected: string | null) {
		if (expected) {
			testParsing(input, id(expected))
		} else {
			testErrorParsing(input)
		}
	}
})

describe('parsing line comment', () => {
	testParsing('1;comment', num(1))
	testParsing(';comment\n1', num(1))
	testParsing('1;comment\n\n', num(1))
	testParsing('1;comment\n;comment\n', num(1))
	testParsing(';comment\n;comment\n1', num(1))
	testParsing(';\n;\n1', num(1))
	testParsing('[;comment]\n1;comment]\n]', vec([num(1)]))
	testParsing(';;\n1', num(1))
})

describe('parsing app expressions', () => {
	testParsing('(+ 1 2)', app(id('+'), num(1), num(2)))
	testParsing('(* 1 2)', app(id('*'), num(1), num(2)))
	testParsing('(()2())', app(app(), num(2), app()))
	testParsing('(x _)', app(x, all))
	testParsing('(x ())', app(x, app()))
	testParsing('(x)', app(x))
	testParsing('(0 false)', app(num(1), id('false')))
	testParsing('((true) x)', app(app(id('true')), x))
})

describe('parsing scope', () => {
	testParsing('(let x: 1 x)', scope({x: num(1)}, x))
	testParsing('(let x: 1)', scope({x: num(1)}))
	testParsing('(let x: (let x: 1))', scope({x: scope({x: num(1)})}))
	testParsing('(let (let 1))', scope({}, scope({}, num(1))))
	testParsing('(let)', scope({}))
	testParsing('(let x:[]y:[]z)', scope({x: vec(), y: vec()}, id('z')))

	testParsing('(let+ 20)', app(id('let+'), num(20)))

	testErrorParsing('(let==: 10)')
})

describe('parsing vector', () => {
	testParsing('\t[   ]  ', vec())
	testParsing('[    1   \t]', vec([num(1)]))
	testParsing('[1 2 3]', vec([num(1), num(2), num(3)]))
	testParsing('[1 [2] 3]', vec([num(1), vec([num(2)]), num(3)]))
	testParsing('[1[2] 3]', vec([num(1), vec([num(2)]), num(3)]))
	testParsing(
		'[(+) false (+) +]',
		vec([app(id('+')), id('false'), app(id('+')), id('+')])
	)
	testParsing('[...1]', vec([], 0, num(1)))
	testParsing('[1?]', vec([num(1)], 0))
	testParsing('[1? ...2]', vec([num(1)], 0, num(2)))
	testParsing('[1 2?]', vec([num(1), num(2)], 1))
	testParsing('[1 2? 3? ...4]', vec([num(1), num(2), num(3)], 1, num(4)))
	testErrorParsing('[1? 2]')
	testErrorParsing('[1? 2 3? 4?]')
})

describe('parsing dictionary', () => {
	testParsing('{   a:    1 }', dict({a: num(1)}))
	testParsing('{\t"foo bar": 1\t}', dict({'foo bar': num(1)}))
	testParsing('{   }', dict({}))
	testParsing('{a: A b: B}', dict({a: id('A'), b: id('B')}))
	testParsing('{a: {a: 1}}', dict({a: dict({a: num(1)})}))
	testParsing('{a?:1}', dict({a: num(1)}, ['a']))
	testParsing(
		'{a?:1 b:2 ...c}',
		dict(
			{
				a: num(1),
				b: num(2),
			},
			['a'],
			id('c')
		)
	)
})

describe('parsing function definition', () => {
	testParsing('(=> [x:Num] x)', fnDef(null, {x: Num}, x))
	testParsing('(=> [ x: Num ] x)', fnDef(null, {x: Num}, x))
	testParsing('(=> [x: Num y: Bool] x)', fnDef(null, {x: Num, y: Bool}, x))
	testParsing('(=> [] _)', fnDef(null, {}, all))
	testParsing('(=>[]_)', fnDef(null, {}, all))
	testParsing('(=>()[]_)', fnDef([], {}, all))
	testParsing('(=> [] ())', fnDef(null, {}, app()))
	testParsing('(=> [] (+ 1 2))', fnDef(null, {}, app(id('+'), num(1), num(2))))
	testParsing('(=> [] (=> [] 1))', fnDef(null, {}, fnDef(null, {}, num(1))))

	// Polymorphic functions
	testParsing('(=> (T) [x:T] x)', fnDef(['T'], {x: id('T')}, x))
	testParsing('(=> (T U) [x:T] x)', fnDef(['T', 'U'], {x: id('T')}, x))
	testParsing('(=> () [] Num)', fnDef([], {}, Num))
	testErrorParsing('(=> <1> [] Num)')

	// functions with rest parameter
	testParsing(
		'(=> [...x:x] y)',
		fnDef(null, paramsDef({}, 0, {name: 'x', expr: x}), y)
	)
	testParsing(
		'(=> [x:x ...y:y] z)',
		fnDef(null, paramsDef({x}, 1, {name: 'y', expr: y}), z)
	)
})

describe('parsing function type', () => {
	testParsing('(-> [a:[...x]] x)', fnType(null, {a: vec([], 0, x)}, x))
	testParsing('(-> [x:_] _)', fnType(null, {x: all}, all))
	testParsing('(-> [x:[]] ())', fnType(null, {x: vec()}, app()))
	testParsing('(-> [] z)', fnType(null, {}, z))
	testParsing('(->[]z)', fnType(null, {}, z))
	testParsing('(->()[]z)', fnType([], {}, z))
	testParsing('(\n->[]z\n)', fnType(null, {}, z))
	testParsing('(-> [] [])', fnType(null, {}, vec()))
	testParsing('(-> [x:x] z)', fnType(null, {x}, z))
	testParsing('(-> [x:x y:y] z)', fnType(null, {x, y}, z))
	testParsing('(-> [x:x y:y z:z] w)', fnType(null, {x, y, z}, w))
	testParsing('(-> [a:[x y]] z)', fnType(null, {a: vec([x, y])}, z))
	testParsing('(-> [x:x] z)', fnType(null, {x}, z))
	testParsing('(-> [x:x y:y] z)', fnType(null, {x, y}, z))

	testParsing('(-> (T) [x:T] T)', fnType(['T'], {x: id('T')}, id('T')))
	testParsing('(-> (T U) [x:T] T)', fnType(['T', 'U'], {x: id('T')}, id('T')))
	testErrorParsing('(-> () [] Num)')
	testErrorParsing('(-> (1) [] Num)')

	testParsing('(-> [x?:x] y)', fnType(null, paramsDef({x}, 0), y))
	testParsing('(-> [x?:x] y)', fnType(null, paramsDef({x}, 0), y))
	testParsing('(-> [x?:x] y)', fnType(null, paramsDef({x}, 0), y))
	testParsing('(-> [x:x y?:y] z)', fnType(null, paramsDef({x, y}, 1), z))
})

describe('parsing value metadata', () => {
	testParsing('^metadata 0', valueMeta(id('metadata'), num(0)))
	testParsing('^{}0', valueMeta(dict(), num(0)))
	testParsing('^\t{default: 0}\n0', valueMeta(dict({default: num(0)}), num(0)))
	testParsing('^{}()', valueMeta(dict(), app()))

	testParsing(
		'^{default: true} Bool',
		valueMeta(dict({default: id('true')}), id('Bool'))
	)

	testParsing(
		'^{default: 0} ^{default: 1} Number',
		valueMeta(
			dict({default: num(0)}),
			valueMeta(dict({default: num(1)}), id('Number'))
		)
	)

	testParsing(
		'^^{a: 1} {b: 2} T',
		valueMeta(valueMeta(dict({a: num(1)}), dict({b: num(2)})), id('T'))
	)

	testErrorParsing('Bool^true')
	testErrorParsing('^{true}Bool')
})

describe('parsing try catch', () => {
	testParsing('(try 0 x)', tryCatch(num(0), id('x')))
	testParsing('(try[]())', tryCatch(vec(), app()))
	testParsing('(try+())', app(id('try+'), app()))
})

describe('parsing expression metadata', () => {
	// testParsing('layer#{}', id('layer').setNodeMeta(new NodeMeta(dict())))
	// testParsing(
	// 	'layer#{collapsed: true}',
	// 	id('layer').setNodeMeta(new NodeMeta(dict({collapsed: id('true')})))
	// )
	// testParsing(
	// 	'^{default: 0 label: "number"} Num#{prop: "A"}',
	// 	id('Num')
	// 		.setValueMeta(new ValueMeta(num(0), dict({label: str('number')})))
	// 		.setNodeMeta(new NodeMeta(dict({prop: str('A')})))
	// )
	// testErrorParsing('layer#{}#{}')
	// testErrorParsing('Num#{}^0')
})

function testParsing(input: string, expected: Expr) {
	test(`parsing '${input}' to be ${expected.print()}`, () => {
		const result = parse(input)
		if (!isSame(result, expected)) {
			console.log(result)
			throw new Error('Not as same as expected, got=' + result.print())
		}
		// if (result.print() !== input) {
		// 	throw new Error(`Doesn't store CST properly, got='${result.print()}'`)
		// }
	})
}

function testErrorParsing(input: string) {
	test(`parsing '${input}' throws an error`, () => {
		try {
			const result = parse(input)
			throw new Error('Unexpectedly parsed as ' + result.print())
		} catch {
			return
		}
	})
}

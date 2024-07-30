import P from 'parsimmon'

import {
	Ast,
	Current,
	DictLiteral,
	Key,
	List,
	Parent,
	Scope,
	Sym,
	unit,
	VectorLiteral,
} from './ast'
import {
	createDictDelimiters,
	createScopeDelimiters,
	createSeqDelimiters,
} from './util/createDelimiters'

function zip<T1, T2>(coll: [T1, T2][]): [T1[], T2[]] {
	const as: T1[] = []
	const bs: T2[] = []

	for (const [a, b] of coll) {
		as.push(a)
		bs.push(b)
	}

	return [as, bs]
}

// string Parser modofiers
function zeroOrOne(parser: P.Parser<string>) {
	return parser.atMost(1).tie()
}

function many(parser: P.Parser<string>) {
	return parser.many().tie()
}

function seq(...parsers: P.Parser<string>[]) {
	return P.seq(...parsers).tie()
}

// Internal parsers
const Comment = P.seq(
	P.string('//'),
	P.notFollowedBy(P.newline).then(P.any).many().tie()
)
	.tie()
	.desc('comment')

const OneOrMoreDigits = P.regex(/[0-9]+/)

const Dot = P.string('.')
const TripleDots = P.string('...')

const PCurrentPath = P.string('.').result(Current)
const PParentPath = P.string('..').result(Parent)

const Punctuation = P.oneOf('()[]{}"@#^:;.,?/\\')

const AllowedCharForName = P.notFollowedBy(
	P.alt(P.digit, P.whitespace, Punctuation)
).then(P.any)

const Reserved = new Set(['=>', 'match', 'Infinity', '-Infinity', 'NaN'])

const NameKey = seq(
	AllowedCharForName,
	many(P.alt(P.digit, AllowedCharForName))
).assert(name => !Reserved.has(name), 'cannot use reserved keyword as a symbol')

const IndexKey = P.regex(/([1-9][0-9]*|0)/).map(parseInt)

const FiniteNumericString = seq(
	P.regex(/[+-]?/),
	P.alt(
		// Float
		seq(P.digits, Dot, OneOrMoreDigits),
		// Integer
		seq(OneOrMoreDigits, zeroOrOne(Dot))
	)
)

const sep__ = <T>(parser: P.Parser<T>): P.Parser<[T[], string[]]> => {
	return P.alt(
		// 1 or more elements
		P.seq(
			// First element
			parser,
			// rest elements
			P.seq(__, parser).many()
		).map(([first, restPart]) => {
			const [__s, rest] = zip(restPart)
			return [[first, ...rest], __s]
		}),
		// 0 elements
		P.empty().of<[T[], string[]]>([[], []])
	)
}

const ReservedNumericString = P.alt(P.regex(/-?Infinity/), P.string('NaN'))

/**
 * 0文字以上の区切り文字。
 */
const _ = seq(
	P.optWhitespace,
	many(seq(zeroOrOne(Comment), P.newline, P.optWhitespace)),
	zeroOrOne(Comment.skip(P.eof))
).desc('delimiter')

export const __ = _.assert(
	s => s.length > 0,
	'zero-length delimiter is not allowed'
).desc('non-zero length delimiter')

interface IParser {
	Program: Ast
	Ast: Ast
	Number: number
	String: string
	Symbol: Sym
	List: List
	VectorLiteral: VectorLiteral
	DictLiteral: DictLiteral
}

export const Parser = P.createLanguage<IParser>({
	Program(r) {
		return P.alt(
			P.seqMap(_, r.Ast, _, (before, ast) => ast),
			// Empty program
			_.of(unit)
		).desc('program')
	},
	Ast(r) {
		return P.alt(
			r.Number,
			r.String,
			r.List,
			r.VectorLiteral,
			r.DictLiteral,
			r.Symbol
		)
	},
	Number() {
		return P.alt(ReservedNumericString, FiniteNumericString)
			.map(parseFloat)
			.desc('number')
	},
	String() {
		return P.string('"')
			.then(P.regex(/[^"]*/))
			.skip(P.string('"'))
			.desc('string')
	},
	Symbol() {
		// First path must not be begin with IndexKey
		const FirstKey = P.alt<Key>(PParentPath, PCurrentPath, NameKey)

		// Rest paths can be whichever
		const RestKey = P.alt<Key>(PParentPath, PCurrentPath, NameKey, IndexKey)

		// Paths (xx/yy/zz/1/2/3)
		const Path = P.seq(FirstKey, P.string('/').then(RestKey).many()).map<Key[]>(
			([first, rest]) => [first, ...rest]
		)

		// PropKeys (.y.z.1.2.3)
		const Props = P.seqMap(
			P.string('.'),
			P.alt<string | number>(NameKey, IndexKey),
			(_, key) => key
		).many()

		return P.notFollowedBy(TripleDots).then(
			P.seq(Path, Props).map(([path, keys]) => new Sym(path, keys))
		)
	},
	List(r) {
		return P.seq(_, sep__(r.Ast), _)
			.wrap(P.string('('), P.string(')'))
			.map(([_0, [items, __1s], _2]) => {
				const ast = new List(items)
				ParseInfo.set(ast, {delimiters: [_0, ...__1s, _2]})
				return ast
			})
			.desc('list')
	},
	VectorLiteral(r) {
		return P.seq(_, sep__(r.Ast), _)
			.wrap(P.string('['), P.string(']'))
			.map(([_0, [items, __1s], _2]) => {
				const ast = new VectorLiteral(items)
				ParseInfo.set(ast, {delimiters: [_0, ...__1s, _2]})
				return ast
			})
			.desc('vector')
	},
	DictLiteral(r) {
		const Entry = P.seq(NameKey, _, P.string(':'), _, r.Ast).map(
			([key, , , , value]) => [key, value] as const
		)

		return P.seq(_, sep__(Entry), _)
			.wrap(P.string('{'), P.string('}'))
			.map(([_0, [entries, __1s], _2]) => {
				const ast = new DictLiteral(entries)
				ParseInfo.set(ast, {delimiters: [_0, ...__1s, _2]})
				return ast
			})
	},
})

export function parse(input: string): Ast {
	return Parser.Program.tryParse(input)
}

/**
 * テンプレート構文で s`+` のように呼び出して、Symのインスタンスを返す
 */
export function s(strings: TemplateStringsArray): Sym {
	const str = strings.raw[0]
	return Parser.Symbol.tryParse(str)
}

const ParseInfo = new WeakMap<
	List | VectorLiteral | DictLiteral | Scope,
	{delimiters: string[]}
>()

export function getDelimiters(ast: List | VectorLiteral | DictLiteral | Scope) {
	const delimiters = ParseInfo.get(ast)?.delimiters

	if (delimiters) {
		return delimiters
	}

	switch (ast.type) {
		case 'List':
		case 'VectorLiteral':
			return createSeqDelimiters(ast)
		case 'DictLiteral':
			return createDictDelimiters(ast.entries.length)
		case 'Scope':
			return createScopeDelimiters(ast)
	}
}

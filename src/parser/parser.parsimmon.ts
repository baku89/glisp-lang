import P from 'parsimmon'

import {
	App,
	Expr,
	NumberLiteral,
	StringLiteral,
	Symbol,
	VecLiteral,
} from '../expr'

function zip<T1, T2, T3, T4>(
	coll: [T1, T2, T3?, T4?][]
): [T1[], T2[], T3[], T4[]] {
	const as: T1[] = []
	const bs: T2[] = []
	const cs: T3[] = []
	const ds: T4[] = []

	for (const [a, b, c, d] of coll) {
		as.push(a)
		bs.push(b)
		if (c) cs.push(c)
		if (d) ds.push(d)
	}

	return [as, bs, cs, ds]
}

// string Parser modofiers
function zeroOrOne(parser: P.Parser<string>) {
	return parser.atMost(1).tie()
}

function oneOrMore(parser: P.Parser<string>) {
	return parser.atLeast(1).tie()
}

function many(parser: P.Parser<string>) {
	return parser.many().tie()
}

function seq(...parsers: P.Parser<string>[]) {
	return P.seq(...parsers).tie()
}

function getOptionalPos(optionalFlags: boolean[], label: string) {
	let optionalPos = optionalFlags.length
	let i = 0

	for (; i < optionalFlags.length; i++) {
		if (optionalFlags[i]) {
			optionalPos = i
			break
		}
	}

	for (i++; i < optionalFlags.length; i++) {
		if (!optionalFlags[i]) {
			throw new Error(`A required ${label} cannot follow an optional ${label}`)
		}
	}

	return optionalPos
}

// Internal parsers
const OneOrMoreDigits = oneOrMore(P.digit)

const Punctuation = P.oneOf('()[]{}"@#^:;,.?\\')

const AllowedCharForSymbol = P.notFollowedBy(
	P.alt(P.digit, P.whitespace, Punctuation)
).then(P.any)

const Comment = seq(
	P.string(';'),
	many(P.notFollowedBy(P.newline).then(P.any))
).desc('comment')

const Whitespace = P.alt(P.whitespace, P.string(',')).desc('whitespace')

const Delimiter = seq(
	zeroOrOne(Whitespace),
	many(seq(zeroOrOne(Comment), P.newline, many(Whitespace))),
	zeroOrOne(Comment.skip(P.eof))
).desc('delimiter')
)

interface IParser {
	Program: Expr
	Expr: Expr
	NumberLiteral: NumberLiteral
	StringLiteral: StringLiteral
	App: App
	VecLiteral: VecLiteral
	Symbol: Symbol
}

export const Parser = P.createLanguage<IParser>({
	Program(r) {
		return P.seqMap(Delimiter, r.Expr, Delimiter, (_, expr) => {
			return expr
		}).desc('program')
	},
	Expr(r) {
		return P.alt(
			r.NumberLiteral,
			r.StringLiteral,
			r.App,
			r.VecLiteral,
			r.Symbol
		).desc('expression')
	},
	NumberLiteral() {
		return P.alt(
			seq(
				P.regex(/[+-]?/),
				P.alt(
					// Integer
					seq(OneOrMoreDigits, zeroOrOne(P.string('.'))),
					// Float
					seq(P.digits, P.string('.'), OneOrMoreDigits)
				)
			),
			P.regex(/-?Infinity/),
			P.string('NaN')
		)
			.map(raw => {
				const expr = new NumberLiteral(parseFloat(raw))
				expr.extras = {raw}
				return expr
			})
			.desc('numeric literal')
	},
	StringLiteral() {
		return StringLiteralParser.map(raw => new StringLiteral(raw)).desc(
			'string literal'
		)
	},
	App(r) {
		return P.seq(Delimiter, P.seq(r.Expr, Delimiter).many())
			.wrap(P.string('('), P.string(')'))
			.map(([d0, itemDs]) => {
				const [items, ds] = zip(itemDs)

				const delimiters = [d0, ...ds]

				const expr = new App(...items)
				expr.extras = {delimiters}

				return expr
			})
			.desc('function application')
	},
	VecLiteral(r) {
		return P.seq(
			Delimiter,
			// Items part
			P.seq(
				r.Expr,
				zeroOrOne(P.string('?')).map(r => !!r),
				Delimiter
			).many(),
			// Rest part
			P.seq(P.string('...'), r.Expr, Delimiter).atMost(1)
		)
			.wrap(P.string('['), P.string(']'))
			.map(([d0, itemDs, restDs]) => {
				const [items, optionalFlags, ds] = zip(itemDs)
				const [, rest, dl] = restDs[0] ?? [null, undefined, null]

				const optionalPos = getOptionalPos(optionalFlags, 'item')

				const delimiters = [d0, ...ds, ...(dl !== null ? [dl] : [])]

				const expr = new VecLiteral(items, optionalPos, rest)
				expr.extras = {delimiters}
				return expr
			})
	},
	Symbol() {
		return seq(AllowedCharForSymbol, many(P.alt(P.digit, AllowedCharForSymbol)))
			.map(name => new Symbol(name))
			.desc('symbol')
	},
})

import P from 'parsimmon'

import {App, Expr, NumberLiteral, StringLiteral} from '../expr'

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

interface IParser {
	Program: Expr
	Expr: Expr
	NumberLiteral: NumberLiteral
	StringLiteral: StringLiteral
	App: App
}

const OneOrMoreDigits = P.digit.atLeast(1).tie()

export const Parser = P.createLanguage<IParser>({
	Program(r) {
		return P.seqMap(P.optWhitespace, r.Expr, P.optWhitespace, (_, expr) => {
			return expr
		}).desc('program')
	},
	Expr(r) {
		return P.alt(r.NumberLiteral, r.StringLiteral, r.App).desc('expression')
	},
	NumberLiteral() {
		return P.alt(
			P.seq(
				P.regex(/[+-]?/),
				P.alt(
					// Integer
					P.seq(OneOrMoreDigits, P.string('.').atMost(1).tie()).tie(),
					// Float
					P.seq(P.digits, P.string('.'), OneOrMoreDigits).tie()
				)
			).tie(),
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
		return P.noneOf('"')
			.many()
			.tie()
			.wrap(P.string('"'), P.string('"'))
			.map(raw => new StringLiteral(raw))
			.desc('string literal')
	},
	App(r) {
		return P.seq(P.optWhitespace, P.seq(r.Expr, P.optWhitespace).many())
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
})

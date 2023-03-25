import P from 'parsimmon'

import {
	App,
	DictLiteral,
	Expr,
	FnDef,
	Literal,
	Match,
	ParamsDef,
	ParentExpr,
	Program,
	Scope,
	Symbol,
	TypeVarsDef,
	ValueMeta,
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
		if (c !== undefined) cs.push(c)
		if (d !== undefined) ds.push(d)
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

/**
 * Matches zero or one time. Equivalent to ? (question mark) in Regex.
 */
function opt<T>(parser: P.Parser<T>): P.Parser<T | null> {
	return parser.atMost(1).map(result => result[0] ?? null)
}

/**
 * Check if the boolean array is like [...false, ...true],
 * and returns the first index of element with true.
 * e.g.
 * [false, true true] => 1
 * [true] => 0
 * [false, true, false] => Error
 */
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

const Punctuation = P.oneOf('()[]{}"@#^:;.,?/\\')

const AllowedCharForSymbol = P.notFollowedBy(
	P.alt(P.digit, P.whitespace, Punctuation)
).then(P.any)

const Comment = seq(
	P.string(';'),
	many(P.notFollowedBy(P.newline).then(P.any))
).desc('comment')

const Whitespace = P.alt(P.whitespace, P.string(',')).desc('whitespace')

const _ = seq(
	zeroOrOne(Whitespace),
	many(seq(zeroOrOne(Comment), P.newline, many(Whitespace))),
	zeroOrOne(Comment.skip(P.eof))
).desc('delimiter')

const __ = _.assert(
	s => s.length > 0,
	'zero-length delimiter is not allowed'
).desc('non-zero length delimiter')

const OptionalMark = zeroOrOne(P.string('?')).map(r => !!r)

const followedByColon = <T>(parser: P.Parser<T>): P.Parser<T> => {
	return P.seqMap(parser, P.string(':'), p => p)
}

const Reserved = new Set([
	'=>',
	'let',
	'match',
	'return',
	'Infinity',
	'-Infinity',
	'NaN',
])

// Main parser
interface IParser {
	Program: Program
	Expr: Expr
	NumberLiteral: Literal
	StringLiteral: Literal
	ScopeEntry: [string, string, Expr, string]
	Scope: Scope
	Match: Match
	TypeVarsDef: TypeVarsDef
	ParamsDef: ParamsDef
	FnDef: FnDef
	App: App
	VecLiteral: VecLiteral
	DictEntry: [string, boolean, Expr, [string, string]]
	DictLiteral: DictLiteral
	NamePath: string
	Symbol: Symbol
	ValueMeta: ValueMeta
}

export const Parser = P.createLanguage<IParser>({
	Program(r) {
		return P.alt(
			P.seqMap(
				_,
				r.Expr,
				_,
				(before, expr, after) => new Program(before, expr, after)
			),
			// Empty program
			_.map(s => new Program(s))
		).desc('program')
	},
	Expr(r) {
		return P.alt(
			r.NumberLiteral,
			r.StringLiteral,
			r.Scope,
			r.Match,
			r.FnDef,
			r.App,
			r.VecLiteral,
			r.DictLiteral,
			r.Symbol,
			r.ValueMeta
		).desc('expression')
	},
	NumberLiteral() {
		return P.alt(
			seq(
				P.regex(/[+-]?/),
				P.alt(
					// Float
					seq(P.digits, P.string('.'), OneOrMoreDigits),
					// Integer
					seq(OneOrMoreDigits, zeroOrOne(P.string('.')))
				)
			),
			P.regex(/-?Infinity/),
			P.string('NaN')
		)
			.map(raw => {
				const expr = new Literal(parseFloat(raw))
				expr.extras = {raw}
				return expr
			})
			.desc('numeric literal')
	},
	StringLiteral() {
		return many(P.noneOf('"'))
			.wrap(P.string('"'), P.string('"'))
			.map(raw => new Literal(raw))
			.desc('string literal')
	},
	TypeVarsDef(r) {
		return P.seq(_, P.seq(r.NamePath, _).many())
			.wrap(P.string('('), P.string(')'))
			.map(([d0, ItemsPart]) => {
				const [items, ds] = zip(ItemsPart)
				const expr = new TypeVarsDef(items)

				expr.extras = {
					delimiters: [d0, ...ds],
				}

				return expr
			})
	},
	ParamsDef(r) {
		return P.seq(
			_,
			// Items part
			r.DictEntry.many(),
			// Rest part
			opt(P.seq(P.string('...'), followedByColon(r.NamePath), _, r.Expr, _))
		)
			.wrap(P.string('['), P.string(']'))
			.map(([d0, pairs, restDs]) => {
				const items: ParamsDef['items'] = {}
				const optionalFlags: boolean[] = []

				const delimiters = [d0]

				for (const [key, optional, expr, ds] of pairs) {
					if (key in items) throw new Error(`Duplicated name: ${key}`)

					items[key] = expr
					optionalFlags.push(optional)
					delimiters.push(...ds)
				}

				const optionalPos = getOptionalPos(optionalFlags, 'parameter')

				let rest: ParamsDef['rest']
				if (restDs) {
					const [, name, dr0, expr, dr1] = restDs
					rest = {name, expr}
					delimiters.push(dr0, dr1)
				}

				const expr = new ParamsDef(items, optionalPos, rest)
				expr.extras = {delimiters}
				return expr
			})
	},
	FnDef(r) {
		return P.seqMap(
			_,
			P.string('=>'),
			_,
			// Type variables part
			opt(P.seq(r.TypeVarsDef, _)),
			// Parameters part
			r.ParamsDef,
			_,
			// Return type part
			opt(P.seq(P.string(':'), _, r.Expr, _)),
			// Body part
			opt(P.seq(r.Expr, _)),
			//(d0=> d1 (   ...  ) d2  [       ]  d3  : d4 RetTy d5   body  d6)
			(d0, _, d1, typeVarsPart, paramsDef, d3, returnTypePart, bodyPart) => {
				const delimiters = [d0, d1]

				let typeVars: TypeVarsDef | null = null
				if (typeVarsPart) {
					const [_typeVars, d2] = typeVarsPart
					typeVars = _typeVars
					delimiters.push(d2)
				}

				delimiters.push(d3)

				let returnType: Expr | null = null
				if (returnTypePart) {
					const [, d4, _returnType, d5] = returnTypePart
					returnType = _returnType
					delimiters.push(d4, d5)
				}

				let body: Expr | null = null
				if (bodyPart) {
					const [_body, d6] = bodyPart
					body = _body
					delimiters.push(d6)
				}

				const expr = new FnDef(typeVars, paramsDef, returnType, body)
				expr.extras = {delimiters}
				return expr
			}
		).wrap(P.string('('), P.string(')'))
	},
	App(r) {
		return P.seq(_, P.seq(r.Expr, _).many())
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
	ScopeEntry(r) {
		return P.seq(followedByColon(r.NamePath), _, r.Expr, _).map(
			([name, _0, expr, _1]) => [name, _0, expr, _1]
		)
	},
	Scope(r) {
		return P.seq(
			_,
			P.string('let'),
			// Key-value pairs part
			opt(P.seq(__, r.ScopeEntry.many())),
			// Return value part
			opt(P.seq(r.Expr, _))
		)
			.wrap(P.string('('), P.string(')'))
			.map(([_0, , itemsPart, outPart]) => {
				const items: Scope['items'] = {}
				const delimiters = [_0]

				if (itemsPart) {
					const [__1, entries] = itemsPart

					delimiters.push(__1)

					for (const [name, _2a, expr, __2b] of entries) {
						if (name in items) {
							throw new Error(`Duplicated symbol name: '${name}'`)
						}

						items[name] = expr
						delimiters.push(_2a, __2b)
					}
				}

				let out: Expr | undefined
				if (outPart) {
					const [_out, _3] = outPart
					out = _out
					delimiters.push(_3)
				}

				const expr = new Scope(items, out)
				expr.extras = {delimiters}
				return expr
			})
			.desc('scope')
	},
	Match(r) {
		return P.seq(
			_,
			P.string('match'),
			_,
			P.seq(followedByColon(r.NamePath), _, r.Expr, _),
			P.seq(followedByColon(r.Expr), _, r.Expr, _).many(),
			opt(P.seq(r.Expr, _))
		)
			.wrap(P.string('('), P.string(')'))
			.map(([d0, , d1, capture, casesPart, otherwisePart]) => {
				const [captureName, d2, subject, d3] = capture

				const delimiters = [d0, d1, d2, d3]

				const cases: Match['cases'] = []

				for (const [pattern, d4, out, d5] of casesPart) {
					cases.push([pattern, out])
					delimiters.push(d4, d5)
				}

				let otherwise: Match['otherwise']
				if (otherwisePart) {
					otherwise = otherwisePart[0]
					delimiters.push(otherwisePart[1])
				}

				const expr = new Match(captureName, subject, cases, otherwise)
				expr.extras = {delimiters}
				return expr
			})
	},
	VecLiteral(r) {
		return P.seq(
			_,
			// Items part
			P.seq(r.Expr, OptionalMark, _).many(),
			// Rest part
			opt(P.seq(P.string('...'), r.Expr, _))
		)
			.wrap(P.string('['), P.string(']'))
			.map(([d0, ItemsPart, RestPart]) => {
				const [items, optionalFlags, ds] = zip(ItemsPart)
				const [, rest, dl] = RestPart ?? [null, null, null]

				const optionalPos = getOptionalPos(optionalFlags, 'item')

				const delimiters = [d0, ...ds, ...(dl !== null ? [dl] : [])]

				const expr = new VecLiteral(items, optionalPos, rest)
				expr.extras = {delimiters}
				return expr
			})
	},
	DictEntry(r) {
		return P.seq(
			followedByColon(P.seq(r.NamePath, OptionalMark)),
			_,
			r.Expr,
			_
		).map(([[key, optional], d0, expr, d1]) => {
			return [key, optional, expr, [d0, d1]]
		})
	},
	DictLiteral(r) {
		return P.seq(
			_,
			// Pairs part
			r.DictEntry.many(),
			// Rest part
			opt(P.seq(P.string('...'), r.Expr, _))
		)
			.wrap(P.string('{'), P.string('}'))
			.map(([d0, pairsPart, restPart]) => {
				const [, rest, dl] = restPart ?? [null, null, null]

				const optionalKeys = new Set<string>()
				const delimiters = [d0]

				const items: DictLiteral['items'] = {}
				for (const [key, optional, value, ds] of pairsPart) {
					if (key in items) throw new Error(`Duplicated key: ${key}`)

					items[key] = value
					if (optional) optionalKeys.add(key)

					delimiters.push(...ds)
				}

				if (dl !== null) delimiters.push(dl)

				const expr = new DictLiteral(items, optionalKeys, rest)
				expr.extras = {delimiters}
				return expr
			})
	},
	NamePath() {
		return seq(
			AllowedCharForSymbol,
			many(P.alt(P.digit, AllowedCharForSymbol))
		).assert(
			name => !Reserved.has(name),
			'cannot use reserved keyword as a symbol'
		)
	},
	Symbol(r) {
		return P.notFollowedBy(P.string('...')).then(
			P.seq(
				P.alt(P.string('..'), P.string('.'), r.NamePath),
				P.seq(
					P.string('/'),
					P.alt<string | number>(
						P.string('..'),
						P.string('.'),
						r.NamePath,
						P.regex(/([1-9][0-9]*|0)/).map(parseInt)
					)
				).many()
			).map(([first, restPart]) => {
				const [, rest] = zip(restPart)
				return new Symbol(first, ...rest)
			})
		)
	},
	ValueMeta(r) {
		return P.seq(P.string('^'), _, r.Expr, _, r.Expr)
			.map(([, d0, fields, d1, expr]) => {
				const meta = new ValueMeta(fields, expr)
				meta.extras = {delimiters: [d0, d1]}
				return meta
			})
			.desc('value metadata')
	},
})

export function parse(str: string, parent: ParentExpr | null = null): Program {
	const expr = Parser.Program.tryParse(str)
	expr.parent = parent
	return expr
}

export function parseModule(str: string): Record<string, Expr> {
	const expr = Parser.Scope.tryParse('(let ' + str + ')')
	return expr.items
}

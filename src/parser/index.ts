import P from 'parsimmon'

import {
	App,
	DictLiteral,
	Expr,
	FnDef,
	InfixNumber,
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
import {TypeSignature} from '../expr'
import {Path} from '../expr/path'

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

const AllowedCharForName = P.notFollowedBy(
	P.alt(P.digit, P.whitespace, Punctuation)
).then(P.any)

const Comment = seq(
	P.string(';'),
	many(P.notFollowedBy(P.newline).then(P.any))
).desc('comment')

const TripleDots = P.string('...')

const _ = seq(
	zeroOrOne(P.whitespace),
	many(seq(zeroOrOne(Comment), P.newline, many(P.whitespace))),
	zeroOrOne(Comment.skip(P.eof))
).desc('delimiter')

const __ = _.assert(
	s => s.length > 0,
	'zero-length delimiter is not allowed'
).desc('non-zero length delimiter')

const OptionalMark = zeroOrOne(P.string('?')).map(r => !!r)

const followedByColon = <T>(parser: P.Parser<T>): P.Parser<T> => {
	return parser.skip(P.string(':'))
}

const sepBy1__ = <T>(parser: P.Parser<T>): P.Parser<[T[], string[]]> => {
	return P.seq(
		// First element
		parser,
		// rest elements
		P.seq(__, parser).many()
	).map(([first, restPart]) => {
		const [__s, rest] = zip(restPart)
		return [[first, ...rest], __s]
	})
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

const FiniteNumericString = seq(
	P.regex(/[+-]?/),
	P.alt(
		// Float
		seq(P.digits, P.string('.'), OneOrMoreDigits),
		// Integer
		seq(OneOrMoreDigits, zeroOrOne(P.string('.')))
	)
)

const ReservedNumericString = P.alt(P.regex(/-?Infinity/), P.string('NaN'))

const PUpPath = P.string('..')
const PCurrentPath = P.string('.')

const NameKey = seq(
	AllowedCharForName,
	many(P.alt(P.digit, P.string('?'), AllowedCharForName))
).assert(name => !Reserved.has(name), 'cannot use reserved keyword as a symbol')

const IndexKey = P.regex(/([1-9][0-9]*|0)/).map(parseInt)

// Main parser
interface IParser {
	Program: Program
	Expr: Expr
	NumberLiteral: Literal
	StringLiteral: Literal
	Scope: Scope
	Match: Match
	TypeVarsDef: TypeVarsDef
	ParamsDef: ParamsDef
	FnDef: FnDef
	App: App
	Unit: App
	VecLiteral: VecLiteral
	DictLiteral: DictLiteral
	Symbol: Symbol
	ValueMeta: ValueMeta
	InfixNumber: InfixNumber
	TypeSignature: TypeSignature
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
			r.TypeSignature,
			r.InfixNumber,
			r.NumberLiteral,
			r.StringLiteral,
			r.Scope,
			r.Match,
			r.FnDef,
			r.App,
			r.Unit,
			r.VecLiteral,
			r.DictLiteral,
			r.Symbol,
			r.ValueMeta
		).desc('expression')
	},
	NumberLiteral() {
		return P.alt(FiniteNumericString, ReservedNumericString)
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
	TypeVarsDef() {
		return P.seq(_, P.seq(NameKey, _).many())
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
		const DictEntry = P.seq(
			followedByColon(P.seq(OptionalMark, NameKey)),
			_,
			r.Expr,
			_
		).map(([[optional, key], d0, expr, d1]) => {
			return [optional, key, expr, [d0, d1]] as const
		})

		return P.seq(
			_,
			// Items part
			DictEntry.many(),
			// Rest part
			opt(P.seq(TripleDots, followedByColon(NameKey), _, r.Expr, _))
		)
			.wrap(P.string('['), P.string(']'))
			.map(([d0, pairs, restDs]) => {
				const items: ParamsDef['items'] = {}
				const optionalFlags: boolean[] = []

				const delimiters = [d0]

				for (const [optional, key, expr, ds] of pairs) {
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
			__,
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
		return P.seq(_, sepBy1__(r.Expr), _)
			.wrap(P.string('('), P.string(')'))
			.map(([_0, [items, __1s], _2]) => {
				const expr = new App(...items)

				const delimiters = [_0, ...__1s, _2]
				expr.extras = {delimiters}

				return expr
			})
			.desc('function application')
	},
	Unit() {
		return P.seqMap(P.string('('), _, P.string(')'), (_paren, _0) => {
			const expr = new App()
			expr.extras = {delimiters: [_0]}
			return expr
		}).desc('unit')
	},
	Scope(r) {
		const ScopeEntry = P.seq(followedByColon(NameKey), _, r.Expr).map(
			([name, _0, expr]) => [name, _0, expr] as const
		)

		return P.seq(
			_,
			P.string('let'),
			// Key-value pairs part
			opt(P.seq(__, sepBy1__(ScopeEntry))),
			// Return value part
			opt(P.seq(__, r.Expr)),
			_
		)
			.wrap(P.string('('), P.string(')'))
			.map(([_0, , itemsPart, retPart, _4]) => {
				const items: Scope['items'] = {}
				const delimiters = [_0]

				if (itemsPart) {
					const [__1, [entries, __2bs]] = itemsPart

					delimiters.push(__1)

					entries.forEach(([name, _2a, expr], i) => {
						if (name in items) {
							throw new Error(`Duplicated symbol name: '${name}'`)
						}

						items[name] = expr
						delimiters.push(_2a)

						if (i < __2bs.length) {
							delimiters.push(__2bs[i])
						}
					})
				}

				let ret: Scope['ret'] = null
				if (retPart) {
					const [__3, ret_] = retPart
					ret = ret_
					delimiters.push(__3)
				}

				delimiters.push(_4)

				const expr = new Scope(items, ret)
				expr.extras = {delimiters}
				return expr
			})
			.desc('scope')
	},
	Match(r) {
		return P.seq(
			_,
			P.string('match'),
			__,
			P.seq(followedByColon(NameKey), _, r.Expr, _),
			P.seq(followedByColon(r.Expr), _, r.Expr, _).many(),
			opt(P.seq(r.Expr, _))
		)
			.wrap(P.string('('), P.string(')'))
			.map(([d0, , d1, capture, casesPart, otherwisePart]) => {
				const [captureName, d2, subject, d3] = capture

				const delimiters = [d0, d1, d2, d3]

				const cases: Match['cases'] = []

				for (const [pattern, d4, then, d5] of casesPart) {
					cases.push([pattern, then])
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
		const Open = P.string('[')
		const Close = P.string(']')

		// e.g. [], [  ]
		const empty = _.wrap(Open, Close).map(_0 => {
			const expr = new VecLiteral()
			expr.extras = {delimiters: [_0]}
			return expr
		})

		// e.g. [...x], [ ...x ]
		const onlyRest = P.seq(_, TripleDots.then(r.Expr), _)
			.wrap(Open, Close)
			.map(([_0, rest, _1]) => {
				const expr = new VecLiteral([], null, rest)
				expr.extras = {delimiters: [_0, _1]}
				return expr
			})

		// e.g. [a ...x] [a b]
		const both = P.seq(
			_,
			sepBy1__(P.seq(OptionalMark, r.Expr)),
			opt(P.seq(__, TripleDots.then(r.Expr))),
			_
		)
			.wrap(Open, Close)
			.map(([_0, [itemsPart, __1s], restPart, _3]) => {
				const [optionalFlags, items] = zip(itemsPart)

				const optionalPos = getOptionalPos(optionalFlags, 'item')

				const [__2, rest] = restPart ?? [null, null]

				const delimiters = [_0, ...__1s]
				if (__2 !== null) delimiters.push(__2)
				delimiters.push(_3)

				const expr = new VecLiteral(items, optionalPos, rest)
				expr.extras = {delimiters}

				return expr
			})

		return P.alt(empty, onlyRest, both)
	},
	DictLiteral(r) {
		const Open = P.string('{')
		const Close = P.string('}')
		const Entry = P.seq(OptionalMark, followedByColon(NameKey), _, r.Expr)

		// e.g. {} { }
		const empty = _.wrap(Open, Close).map(_0 => {
			const expr = new DictLiteral()
			expr.extras = {delimiters: [_0]}
			return expr
		})

		// e.g. {...x}
		const onlyRest = P.seq(_, TripleDots.then(r.Expr), _)
			.wrap(Open, Close)
			.map(([_0, rest, _1]) => {
				const expr = new DictLiteral({}, null, rest)
				expr.extras = {delimiters: [_0, _1]}
				return expr
			})

		// e.g. {a:1} {a:1 ...b}
		const oneOrMore = P.seq(
			_,
			sepBy1__(Entry),
			opt(P.seq(__.skip(TripleDots), r.Expr)),
			_
		)
			.wrap(Open, Close)
			.map(([_0, [entries, __1s], restPart, _3]) => {
				const [__2, rest] = restPart ?? [null, null]

				const optionalKeys = new Set<string>()
				const delimiters = [_0]

				const items: DictLiteral['items'] = {}

				for (const [i, [optional, key, _1, value]] of entries.entries()) {
					if (key in items) throw new Error(`Duplicated key: ${key}`)

					items[key] = value
					if (optional) optionalKeys.add(key)

					delimiters.push(_1)

					if (i < __1s.length) {
						delimiters.push(__1s[i])
					}
				}

				if (__2 !== null) delimiters.push(__2)
				delimiters.push(_3)

				const expr = new DictLiteral(items, optionalKeys, rest)
				expr.extras = {delimiters}
				return expr
			})

		return P.alt(empty, onlyRest, oneOrMore)
	},
	Symbol() {
		// First path must not be begin with IndexKey
		const FirstPath = P.alt<Path>(PUpPath, PCurrentPath, NameKey)

		// Rest paths can be whichever
		const RestPath = P.alt<Path>(
			PUpPath,
			PCurrentPath,
			NameKey,
			IndexKey,
			P.string('=>'),
			P.string('return')
		)

		return P.notFollowedBy(TripleDots).then(
			P.seq(
				// Paths (xx/yy/zz/1/2/3)
				P.seq(FirstPath, P.string('/').then(RestPath).many()).map<Path[]>(
					([first, rest]) => [first, ...rest]
				),
				// PropKeys (x.y.z.1.2.3)
				P.seqMap(
					P.string('.'),
					P.alt<string | number>(NameKey, IndexKey),
					(_, key) => key
				).many()
			).map(([paths, keys]) => new Symbol(paths, keys))
		)
	},
	ValueMeta(r) {
		return P.seq(P.string('^').then(_), r.Expr, _, r.Expr)
			.map(([d0, fields, d1, expr]) => {
				const meta = new ValueMeta(fields, expr)
				meta.extras = {delimiters: [d0, d1]}
				return meta
			})
			.desc('value metadata')
	},
	InfixNumber(r) {
		// TODO: allow other characters that would not affect to the parsing logic
		const InfixName = P.regex(/[a-z!$%&*_=|]+/i)

		// 2e2, 3v3v3
		const Multiple = P.seq(
			FiniteNumericString,
			P.seq(InfixName, FiniteNumericString).atLeast(1)
		).map(([first, rest]) => {
			const [[op, ...opRest], restArgs] = zip(rest)

			const args = [parseFloat(first), ...restArgs.map(parseFloat)]

			if (opRest.some(r => op !== r)) {
				throw new Error('Invalid infix literals')
			}

			const expr = new InfixNumber(op, ...args)

			const raw = [first, ...restArgs]

			expr.extras = {raw}

			return expr
		})

		// 100%, 20mm
		const Unary = P.seq(r.NumberLiteral, InfixName).map(([arg, op]) => {
			const expr = new InfixNumber(op, arg.value as number)
			expr.extras = {raw: [arg.extras?.raw as string]}
			return expr
		})

		return P.alt(Multiple, Unary)
	},
	TypeSignature(r) {
		const ExprBody = P.alt(
			r.InfixNumber,
			r.NumberLiteral,
			r.StringLiteral,
			r.Scope,
			r.Match,
			r.FnDef,
			r.App,
			r.Unit,
			r.VecLiteral,
			r.DictLiteral,
			r.Symbol,
			r.ValueMeta
		) as P.Parser<Exclude<Expr, TypeSignature>>

		return P.seq(ExprBody, _.skip(P.string('::')), _, ExprBody).map(
			([body, _0, _1, signature]) => {
				const expr = new TypeSignature(body, signature)
				expr.extras = {delimiters: [_0, _1]}

				return expr
			}
		)
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

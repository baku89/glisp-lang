import {entries, forOwn, fromPairs, keys, mapValues, values} from 'lodash'
import ordinal from 'ordinal'

import {GlispError} from '../GlispError'
import {Log, WithLog, withLog} from '../log'
import {fromKeysValues} from '../util/fromKeysValues'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {nullishEqual} from '../util/nullishEqual'
import {union} from '../util/SetOperation'
import {Writer} from '../util/Writer'
import {
	All,
	all,
	Dict,
	dict,
	Fn,
	FnType,
	IFn,
	number,
	string,
	TypeVar,
	typeVar,
	Unit,
	unit,
	Value,
	Vec,
	vec,
} from '../value'
import {Env} from './env'
import {createListDelimiters, insertDelimiters} from './PrintUtil'
import {shadowTypeVars, Unifier} from './unify'

/**
 * ASTs that have eval, infer as normal
 */
export type Expr = Exclude<AnyExpr, ParamsDef>

/**
 * Presenting any ASTs
 */
export type AnyExpr = AtomExpr | ParentExpr

/**
 * ASTs that cannot have child elements
 */
export type AtomExpr = Symbol | ValueContainer | Literal

/**
 * expressions that can contain other experssions
 */
export type ParentExpr =
	| App
	| Scope
	| FnDef
	| VecLiteral
	| DictLiteral
	| ValueMeta
	| ParamsDef // No infer
	| Program

export type Arg<T extends Value = Value> = () => T

export interface PrintOptions {
	omitMeta?: boolean
}

/**
 * Base class for all kind of ASTs
 */
export abstract class BaseExpr {
	abstract readonly type: string

	parent: ParentExpr | null = null

	abstract print(options?: PrintOptions): string

	protected abstract forceEval(env: Env): WithLog
	protected abstract forceInfer(env: Env): Value

	abstract resolveSymbol(path: string | number, env: Env): Expr | null

	/**
	 * 式が全く同じ構造かどうかを比較する
	 * メタデータ、シンボルの記法等は区別する
	 * デリミタ、数値リテラルの表記ゆれ、辞書式の順序は区別しない
	 * 主にパーサーのテストコード用
	 */
	abstract isSameTo(expr: AnyExpr): boolean

	abstract clone(): AnyExpr

	// #nodeMeta?: NodeMeta

	/*
	setNodeMeta(meta: NodeMeta) {
		this.#nodeMeta = meta
		this.#nodeMeta.attachedTo = this as any
		return this
	}
	*/

	eval(env = Env.global) {
		return env.memoizeEval(this, this.forceEval)
	}

	infer(env = Env.global) {
		return env.memoizeInfer(this, this.forceInfer)
	}

	getLog = () => this.eval(Env.global).log
}

/**
 * AST representing parsed expression with preserving spaces around it.
 * Also used to represent empty input (only whitespaces, delimiters, comments)
 */
export class Program extends BaseExpr {
	type = 'Program' as const

	constructor(
		public before: string,
		public expr?: Expr,
		public after: string = ''
	) {
		super()
		if (this.expr) this.expr.parent = this
	}

	protected forceEval = (env: Env) => {
		if (!this.expr) {
			return withLog(unit, {level: 'error', reason: 'Empty program'})
		}
		return this.expr.eval(env)
	}

	protected forceInfer = (env: Env) => {
		if (!this.expr) return unit
		return this.expr.infer(env)
	}

	resolveSymbol() {
		return null
	}

	print = (options?: PrintOptions): string => {
		if (this.expr) {
			return this.before + this.expr.print(options) + this.after
		} else {
			return this.before + this.after
		}
	}

	clone = (): Program => {
		return new Program(this.before, this.expr?.clone(), this.after)
	}

	isSameTo = (expr: AnyExpr): boolean => {
		if (this.type !== expr.type) return false
		return nullishEqual(this.expr, expr.expr, isSame)
	}
}

export const UpPath = '..' as const
export const CurrentPath = '.' as const
export type NamePath = string
export type IndexPath = number
export type Path = typeof UpPath | typeof CurrentPath | NamePath | IndexPath

/**
 * AST representing any identifier
 */
export class Symbol extends BaseExpr {
	readonly type = 'Symbol' as const

	public readonly paths: Path[]

	constructor(...paths: Path[]) {
		super()

		if (paths.length === 0) {
			throw new Error('Zero-length path cannot be set to a new Symbol')
		}
		this.paths = paths
	}

	// get name() {
	// 	if (this.paths[0].type !== 'name') throw new Error()
	// 	return this.paths[0].name
	// }

	resolve(env: Env = Env.global): {expr: Expr; mode?: 'param' | 'arg'} | null {
		let expr: Expr | ParamsDef | Program | null = this.parent

		let isFirstPath = true
		let mode: 'param' | 'arg' | undefined

		for (const path of this.paths) {
			while (expr && expr.type === 'Program') {
				expr = expr.parent
			}

			if (!expr) {
				return null
			}

			if (path === UpPath) {
				expr = expr.parent
			} else if (path == CurrentPath) {
				// Do nothing
			} else {
				// path === NamePath || path === IndexPath
				if (!isFirstPath) {
					expr = expr.resolveSymbol(path)
				} else {
					while (expr) {
						if (expr.type === 'Scope') {
							const e = expr.resolveSymbol(path)
							if (e) {
								expr = e
								break
							}
						} else if (expr.type === 'FnDef') {
							if (env.isGlobal) {
								const e = expr.resolveSymbol(path)
								if (e) {
									expr = e
									mode = 'param'
									break
								}
							} else {
								if (typeof path !== 'string') {
									throw new Error('Invalid')
								}
								const arg = env.get(path)
								if (arg) {
									expr = new ValueContainer(arg())
									mode = 'arg'
									break
								}
							}
							env = env.pop()
						}
						expr = expr.parent
					}
				}
			}

			isFirstPath = false
		}

		while (expr && expr.type === 'Program') {
			expr = expr.parent
		}

		if (!expr || expr.type === 'ParamsDef') {
			return null
		}

		return {expr, mode}
	}

	protected forceEval = (env: Env): WithLog => {
		const resolved = this.resolve(env)

		if (!resolved) {
			return withLog(unit, {
				level: 'error',
				ref: this,
				reason: 'Symbol not bound: ' + this.print(),
			})
		}

		const {expr, mode} = resolved

		const shouldUseDefault =
			mode === 'param' &&
			!(expr.type === 'ValueContainer' && expr.value.type == 'TypeVar')

		return expr.eval(env).fmap(v => (shouldUseDefault ? v.defaultValue : v))
	}

	protected forceInfer = (env: Env): Value => {
		const resolved = this.resolve(env)

		if (!resolved) {
			return unit
		}

		const {expr, mode} = resolved

		if (mode) {
			return expr.eval(env).result
		} else {
			return expr.infer(env)
		}
	}

	resolveSymbol = () => null

	print = () => this.paths.join('/')

	isSameTo = (expr: AnyExpr) =>
		this.type === expr.type && this.print() === expr.print()

	clone = () => new Symbol(...this.paths)
}

export const symbol = (...paths: Path[]) => new Symbol(...paths)

/**
 * AST to directry store a value that cannot be parsed from string
 * e.g. DOM，Image
 */
export class ValueContainer<V extends Value = Value> extends BaseExpr {
	readonly type = 'ValueContainer' as const

	constructor(public readonly value: V) {
		super()
	}

	protected forceEval = () => withLog(this.value)

	protected forceInfer = () => {
		if (this.value.isType) return all
		if (this.value.type === 'Fn') return this.value.fnType
		return this.value
	}

	resolveSymbol = () => null

	print = (options?: PrintOptions) => {
		const expr = this.value.toExpr()
		if (expr.type !== this.type) return expr.print(options)
		return `<value container of ${this.value.type}>`
	}

	isSameTo = (expr: AnyExpr) =>
		this.type === expr.type && this.value === expr.value

	clone = () => new ValueContainer(this.value)
}

export const valueContainer = <V extends Value = Value>(value: V) =>
	new ValueContainer(value)

/**
 * AST representing numeric literal
 */
export class Literal extends BaseExpr {
	readonly type = 'Literal' as const

	constructor(public readonly value: number | string) {
		super()
	}

	protected forceEval = () =>
		withLog(
			typeof this.value === 'number' ? number(this.value) : string(this.value)
		)

	protected forceInfer = () => this.forceEval().result

	resolveSymbol = () => null

	print = () => {
		if (!this.extras) {
			this.extras = {raw: this.value.toString()}
		}

		if (typeof this.value === 'number') {
			return this.extras.raw
		} else {
			return '"' + this.extras.raw + '"'
		}
	}

	isSameTo = (expr: AnyExpr) => {
		if (this.type !== expr.type) return false
		if (typeof this.value === 'number' && typeof expr.value === 'number') {
			return (
				this.value === expr.value || (isNaN(this.value) && isNaN(expr.value))
			)
		}
		return this.value === expr.value
	}

	clone = () => new Literal(this.value)

	extras?: {raw: string}
}

export const literal = (value: number | string) => new Literal(value)

/**
 * AST represents function definition
 * e.g.
 * (=> [x: Number]: Number)
 * (=> [x: Number] (+ x 1))
 */
export class FnDef extends BaseExpr {
	readonly type = 'FnDef' as const

	public readonly typeVars?: TypeVarsDef
	public readonly params: ParamsDef
	public readonly returnType?: Expr
	public readonly body?: Expr

	constructor(
		typeVars?: TypeVarsDef | string[] | null,
		params?: ParamsDef | Record<string, Expr> | null,
		returnType?: Expr | null,
		body?: Expr | null
	) {
		super()

		if (typeVars) {
			if (Array.isArray(typeVars)) {
				this.typeVars = new TypeVarsDef(typeVars)
			} else {
				this.typeVars = typeVars
			}
		}

		this.params = params instanceof ParamsDef ? params : new ParamsDef(params)

		if (returnType) {
			this.returnType = returnType
		}

		if (body) {
			this.body = body
		}

		// Set parent
		this.params.parent = this
		if (this.returnType) this.returnType.parent = this
		if (this.body) this.body.parent = this
	}

	protected forceEval = (env: Env): WithLog<FnType | Fn> => {
		// In either case, params need to be evaluated
		const [{params, rest}, paramsLog] = this.params.eval(env).asTuple
		const {optionalPos} = this.params

		let log = new Set<Log>()

		if (this.body) {
			// Returns function
			const {body} = this

			// Infer the return type of function body
			const arg = mapValues(params, p => () => p)
			if (rest) {
				arg[rest.name] = () => vec([], undefined, rest.value)
			}

			const innerEnv = env.extend(arg)
			let returnType = body.infer(innerEnv)

			// When there's explicit notation for return type,
			// check if inferredReturnType <: returnType is true.
			// Otherwise, the function ignores all arguments and always returns
			// the default value of returnType
			let shouldReturnDefaultValue = false

			if (this.returnType) {
				const [annotatedReturnType, returnTypeLog] =
					this.returnType.eval(env).asTuple

				log = union(returnTypeLog)

				if (!returnType.isSubtypeOf(annotatedReturnType)) {
					shouldReturnDefaultValue = true
					log.add({
						level: 'error',
						ref: this,
						reason:
							`The return type of function body '${returnType}' ` +
							`is not a subtype of '${annotatedReturnType}'.`,
					})
				}

				returnType = annotatedReturnType
			}

			// Defines a function object in JS
			let fnObj: IFn

			if (shouldReturnDefaultValue) {
				fnObj = () => withLog(returnType.defaultValue)
			} else {
				const {names, restName} = this.params.getNames()

				fnObj = (...args: Arg[]) => {
					const argDict = fromKeysValues(names, args)
					if (restName) {
						const restArgs = args.slice(names.length)

						let rest: Vec | null = null

						argDict[restName] = () => {
							return (rest ??= vec(restArgs.map(a => a())))
						}
					}

					const innerEnv = env.extend(argDict)

					return body.eval(innerEnv)
				}
			}

			const fnType = new FnType(params, optionalPos, rest, returnType)

			const fn = new Fn(fnType, fnObj, body)

			return withLog(fn, ...paramsLog)
		} else {
			// Returns a function type if there's no function body

			// Evaluates return type. Uses All type when no return type is defined.
			let returnType: Value = all
			if (this.returnType) {
				const [_returnType, returnTypeLog] = this.returnType.eval(env).asTuple
				returnType = _returnType
				log = union(log, returnTypeLog)
			}

			const fnType = new FnType(params, optionalPos, rest, returnType)

			return withLog(fnType, ...paramsLog, ...log)
		}
	}

	protected forceInfer = (env: Env): FnType | All => {
		// To be honest, I wanted to infer the function type
		// without evaluating it, but it works anyway and should be less buggy.
		const fn = this.eval(env).result

		return fn.type === 'Fn'
			? // When the expression is function definition
			  fn.fnType
			: // Otherwise, the expression means function type definition
			  all
	}

	resolveSymbol = (path: number | string): Expr | null => {
		if (typeof path === 'number') return null

		const typeVar = this.typeVars?.get(path)

		if (typeVar) {
			return new ValueContainer(typeVar)
		}

		return this.params.resolveSymbol(path)

		// switch (path) {
		// 	// TODO: Add a path to refer params
		// 	case 'returnType':
		// 		return this.returnType ?? null
		// 	case 'body':
		// 		return this.body ?? null
		// 	default:
		// 		return null
		// }
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			const delimiters = ['', ' ']
			if (this.typeVars) delimiters.push(' ')
			if (this.returnType) delimiters.push('', ' ')
			if (this.body) delimiters.push(' ')

			delimiters.push('')

			this.extras = {delimiters}
		}

		const typeVars = this.typeVars ? [this.typeVars.print()] : []
		const params = this.params.print(options)
		const returnType = this.returnType
			? [':', this.returnType.print(options)]
			: []
		const body = this.body ? [this.body.print(options)] : []

		const elements = ['=>', ...typeVars, params, ...returnType, ...body]

		return '(' + insertDelimiters(elements, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: AnyExpr) =>
		this.type === expr.type &&
		nullishEqual(this.typeVars, expr.typeVars, TypeVarsDef.isSame) &&
		this.params.isSameTo(expr.params) &&
		nullishEqual(this.returnType, expr.returnType, isSame) &&
		nullishEqual(this.body, expr.body, isSame)

	clone = (): FnDef => {
		return new FnDef(
			this.typeVars?.clone(),
			this.params.clone(),
			this.returnType?.clone() ?? null,
			this.body?.clone() ?? null
		)
	}
}

/**
 * Alias of FnDef constructor
 */
export const fnDef = (
	typeVars?: TypeVarsDef | string[] | null,
	param?: ParamsDef | Record<string, Expr> | null,
	returnType?: Expr | null,
	body?: Expr | null
) => new FnDef(typeVars, param, returnType, body)

export class ParamsDef {
	readonly type = 'ParamsDef' as const
	parent!: FnDef

	public items: Record<string, Expr>
	public optionalPos: number
	public rest?: {name: string; expr: Expr}

	constructor(
		items?: Record<string, Expr> | null,
		optionalPos?: number | null,
		rest?: ParamsDef['rest'] | null
	) {
		this.items = items ?? {}
		this.optionalPos = optionalPos ?? values(this.items).length
		if (rest) this.rest = rest

		// Set parent
		forOwn(this.items, p => (p.parent = this))
		if (this.rest) this.rest.expr.parent = this
	}

	eval = (env: Env) => {
		// Infer parameter types by simply evaluating 'em
		const [params, lp] = Writer.mapValues(this.items, p => p.eval(env)).asTuple

		let rest: FnType['rest'], lr: Set<Log>
		if (this.rest) {
			const [value, _lr] = this.rest.expr.eval(env).asTuple
			rest = {name: this.rest.name, value}
			lr = _lr
		} else {
			lr = new Set()
		}

		return Writer.of({params, rest}, ...lp, ...lr)
	}

	resolveSymbol = (path: number | string): Expr | null => {
		if (typeof path !== 'string') return null

		return this.items[path] ?? null
	}

	print = (options?: PrintOptions) => {
		const params = entries(this.items)
		const {optionalPos, rest} = this

		const paramsTokens = params
			.map(([name, value], i) => [
				name + (i < optionalPos ? '' : '?') + ':',
				value.print(options),
			])
			.flat()
		const restTokens = rest ? ['...' + rest.name, rest.expr.print(options)] : []

		const tokens = [...paramsTokens, ...restTokens]

		if (!this.extras) {
			const delimiters = createListDelimiters(tokens.length)
			this.extras = {delimiters}
		}

		const {delimiters} = this.extras

		return '[' + insertDelimiters(tokens, delimiters) + ']'
	}

	extras?: {delimiters: string[]}

	clone = () => {
		return new ParamsDef(
			mapValues(this.items, clone),
			this.optionalPos,
			this.rest
				? {name: this.rest.name, expr: this.rest.expr.clone()}
				: undefined
		)
	}

	getNames = () => {
		return {
			names: keys(this.items),
			restName: this.rest?.name,
		}
	}

	get = (name: string, env: Env) => {
		if (name in this.items) {
			return Writer.of<Expr, Log>(this.items[name])
		}
		if (this.rest && this.rest.name === name) {
			const [rest, lr] = this.rest.expr.eval(env).asTuple
			const expr = new ValueContainer(vec([], undefined, rest))
			return Writer.of(expr, ...lr)
		}
	}

	isSameTo = (expr: AnyExpr): boolean => {
		return (
			this.type === expr.type &&
			isEqualDict(this.items, expr.items, isSame) &&
			this.optionalPos === expr.optionalPos &&
			nullishEqual(
				this.rest,
				expr.rest,
				(a, b) => a.name === b.name && a.expr.isSameTo(b.expr)
			)
		)
	}
}

export const paramsDef = (
	items?: Record<string, Expr> | null,
	optionalPos?: number | null,
	rest?: ParamsDef['rest'] | null
) => new ParamsDef(items, optionalPos, rest)

export class TypeVarsDef {
	readonly typeVars: Record<string, TypeVar>

	constructor(readonly names: string[]) {
		this.typeVars = fromPairs(names.map(name => [name, typeVar(name)]))
	}

	get = (name: string): TypeVar | undefined => this.typeVars[name]

	print = () => {
		if (!this.extras) {
			const delimiters = createListDelimiters(this.names.length)
			this.extras = {delimiters}
		}

		return '(' + insertDelimiters(this.names, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	clone = () => new TypeVarsDef(this.names)

	static isSame(a: TypeVarsDef, b: TypeVarsDef) {
		return isEqualArray(a.names, b.names)
	}
}

export class VecLiteral extends BaseExpr {
	readonly type = 'VecLiteral' as const

	public readonly items: Expr[]
	public readonly optionalPos: number
	public readonly rest?: Expr

	constructor(
		items?: Expr[] | null,
		optionalPos?: number | null,
		rest?: Expr | null
	) {
		super()

		this.items = items ?? []
		this.optionalPos = optionalPos ?? this.items.length

		if (rest) {
			this.rest = rest
		}

		// Set parent
		this.items.forEach(it => (it.parent = this))
		if (rest) rest.parent = this

		// Check if the passed optionalPos is valid
		if (
			this.optionalPos < 0 ||
			this.items.length < this.optionalPos ||
			this.optionalPos % 1 !== 0
		)
			throw new Error('Invalid optionalPos: ' + optionalPos)
	}

	protected forceEval = (env: Env): WithLog => {
		const [items, li] = Writer.map(this.items, i => i.eval(env)).asTuple
		const [rest, lr] = this.rest?.eval(env).asTuple ?? [undefined, []]
		return withLog(vec(items, this.optionalPos, rest), ...li, ...lr)
	}

	protected forceInfer = (env: Env): Value => {
		if (this.rest || this.items.length < this.optionalPos) {
			return all
		}
		const items = this.items.map(it => it.infer(env))
		return vec(items)
	}

	resolveSymbol = (path: number | string): Expr | null => {
		if (typeof path === 'string') return null

		return this.items[path] ?? null
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			const elementsCount = this.items.length + (this.rest ? 1 : 0)
			const delimiters = createListDelimiters(elementsCount)

			this.extras = {delimiters}
		}

		const items = this.items.map(
			(it, i) => it.print(options) + (this.optionalPos <= i ? '?' : '')
		)
		const rest = this.rest ? ['...' + this.rest.print(options)] : []

		const {delimiters} = this.extras

		return '[' + insertDelimiters([...items, ...rest], delimiters) + ']'
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: AnyExpr): boolean =>
		this.type === expr.type &&
		isEqualArray(this.items, expr.items, isSame) &&
		this.optionalPos === expr.optionalPos &&
		nullishEqual(this.rest, this.rest, isSame)

	clone = (): VecLiteral =>
		new VecLiteral(this.items.map(clone), this.optionalPos, this.rest?.clone())
}

export const vecLiteral = (
	items?: Expr[] | null,
	optionalPos?: number | null,
	rest?: Expr | null
) => new VecLiteral(items, optionalPos, rest)

export class DictLiteral extends BaseExpr {
	readonly type = 'DictLiteral' as const

	public readonly items: Record<string, Expr>
	public readonly optionalKeys: Set<string>
	public readonly rest?: Expr

	constructor(
		items?: Record<string, Expr> | null,
		optionalKeys?: Iterable<string> | null,
		rest?: Expr | null
	) {
		super()

		this.items = items ?? {}
		this.optionalKeys = new Set(optionalKeys)

		if (rest) {
			this.rest = rest
		}

		// Set parent
		forOwn(this.items, it => (it.parent = this))
		if (this.rest) this.rest.parent = this
	}

	#isOptional(key: string) {
		return this.optionalKeys.has(key)
	}

	protected forceEval = (env: Env): WithLog => {
		const [items, li] = Writer.mapValues(this.items, it => it.eval(env)).asTuple
		const [rest, lr] = this.rest ? this.rest.eval(env).asTuple : [undefined, []]
		return withLog(dict(items, this.optionalKeys, rest), ...li, ...lr)
	}

	eval!: (env?: Env) => WithLog<Dict>

	protected forceInfer = (env: Env): Value => {
		if (this.optionalKeys.size > 0 || this.rest) return all

		const items = mapValues(this.items, it => it.infer(env))
		return dict(items)
	}

	resolveSymbol(path: string | number): Expr | null {
		if (typeof path === 'number') return null

		return this.items[path] ?? null
	}

	print = (options?: PrintOptions): string => {
		const itemEntries = entries(this.items)

		if (!this.extras) {
			const tokensCount = itemEntries.length * 2 + (this.rest ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const itemTokens = entries(this.items)
			.map(([key, value]) => {
				const optionalMark = this.#isOptional(key) ? '?' : ''
				return [`${key}${optionalMark}:`, value.print(options)]
			})
			.flat()

		const rest = this.rest ? ['...' + this.rest.print(options)] : []

		const {delimiters} = this.extras

		return '{' + insertDelimiters([...itemTokens, ...rest], delimiters) + '}'
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: AnyExpr): boolean =>
		this.type === expr.type &&
		isEqualDict(this.items, expr.items, isSame) &&
		isEqualSet(this.optionalKeys, expr.optionalKeys) &&
		nullishEqual(this.rest, expr.rest, isSame)

	clone = (): DictLiteral =>
		new DictLiteral(
			mapValues(this.items, clone),
			this.optionalKeys,
			this.rest?.clone()
		)
}

export const dictLiteral = (
	items?: Record<string, Expr> | null,
	optionalKeys?: Iterable<string> | null,
	rest?: Expr | null
) => new DictLiteral(items, optionalKeys, rest)

/**
 * AST representing unit literal `()` and function application
 */
export class App extends BaseExpr {
	readonly type = 'App' as const

	readonly fn?: Expr
	readonly args: Expr[]

	constructor(fn?: Expr, ...args: Expr[]) {
		super()
		this.fn = fn
		this.args = args

		// Set parent
		if (fn) fn.parent = this
		args.forEach(a => (a.parent = this))
	}

	#unify(env: Env): [Unifier, Value[], Set<Log>] {
		if (!this.fn) throw new Error('Cannot unify unit literal')

		const [fn, fnLog] = this.fn.eval(env).asTuple

		if (!('fnType' in fn)) return [new Unifier(), [], fnLog]

		const fnType = fn.fnType

		const params = values(fnType.params)

		// 可変長引数関数では無い限り、余分な実引数は無視する
		const args = fnType.rest ? this.args : this.args.slice(0, params.length)

		// 実引数をshadowする必要があるのは、(id id) のように多相関数の引数として
		// 自らを渡した際に、仮引数と実引数とで型変数が被るのを防ぐため
		const shadowedArgs = args.map(a => {
			return shadowTypeVars(a.infer(env))
		})

		const paramsType = vec(params, fnType.optionalPos, fnType.rest?.value)
		const argsType = vec(shadowedArgs)

		const unifier = new Unifier([paramsType, '>=', argsType])

		return [unifier, shadowedArgs, fnLog]
	}

	protected forceEval = (env: Env): WithLog => {
		if (!this.fn) return withLog(unit)

		// Evaluate the function itself at first
		const [fn, fnLog] = this.fn.eval(env).asTuple

		// Check if it's not a function
		if (!('fn' in fn)) {
			return withLog(fn, ...fnLog, {
				level: 'warn',
				ref: this,
				reason: 'Not a function',
			})
		}

		const {fnType} = fn

		// Start function application
		const names = keys(fnType.params)
		const params = values(fnType.params)

		// Unify FnType and args
		const [unifier, shadowedArgs, argLog] = this.#unify(env)
		const unifiedParams = params.map(p => unifier.substitute(p))
		const unifiedArgs = shadowedArgs.map(a => unifier.substitute(a))

		// Length-check of arguments
		const lenArgs = this.args.length
		const lenRequiredParams = fn.fnType.optionalPos

		if (lenArgs < lenRequiredParams) {
			argLog.add({
				level: 'error',
				ref: this,
				reason: `Expected ${lenRequiredParams} arguments, but got ${lenArgs}.`,
			})
		}

		// Check types of args and set them to default if necessary
		const args = unifiedParams.map((pType, i) => {
			const aType = unifiedArgs[i] ?? Unit
			const name = names[i]

			if (aType.isSubtypeOf(pType)) {
				// Type matched
				return () => {
					const [a, la] = this.args[i].eval(env).asTuple
					la.forEach(l => argLog.add(l))
					return a
				}
			} else {
				// Type mismatched
				if (aType.type !== 'Unit') {
					const ord = ordinal(i + 1)
					const p = pType.print({omitMeta: true})
					const a = aType.print({omitMeta: true})
					const d = pType.defaultValue.print({omitMeta: true})
					argLog.add({
						level: 'error',
						ref: this,
						reason:
							`${ord} argument '${name}' expects type: ${p}, ` +
							`but got: ${a}. ` +
							`Uses a default value ${d} instead.`,
					})
				}
				return () => pType.defaultValue
			}
		})

		// For rest argument
		if (fnType.rest) {
			const {name, value: pType} = fnType.rest

			for (let i = unifiedParams.length; i < this.args.length; i++) {
				const aType = unifiedArgs[i]

				if (aType.isSubtypeOf(pType)) {
					// Type matched
					args.push(() => {
						const [a, la] = this.args[i].eval(env).asTuple
						la.forEach(l => argLog.add(l))
						return a
					})
				} else {
					// Type mismatched
					if (aType.type !== 'Unit') {
						const p = pType.print({omitMeta: true})
						const a = aType.print({omitMeta: true})
						const d = pType.defaultValue.print({omitMeta: true})
						argLog.add({
							level: 'error',
							ref: this,
							reason:
								`Rest argument '${name}' expects type: ${p}, ` +
								`but got: ${a}. ` +
								`Uses a default value ${d} instead.`,
						})
					}
					args.push(() => pType.defaultValue)
				}
			}
		}

		// Call the function
		let result: Value, appLog: Set<Log>
		try {
			;[result, appLog] = fn.fn(...args).asTuple
		} catch (e) {
			if (env.isGlobal) {
				const message = e instanceof Error ? e.message : 'Run-time error'
				const ref = e instanceof GlispError ? e.ref : this
				throw new GlispError(ref, message)
			} else {
				throw e
			}
		}

		const unifiedResult = unifier.substitute(result, true)

		// Set this as 'ref'
		const callLogWithRef = [...appLog].map(log => ({...log, ref: this}))

		return withLog(unifiedResult, ...fnLog, ...argLog, ...callLogWithRef)
	}

	protected forceInfer = (env: Env): Value => {
		if (!this.fn) return unit

		const ty = this.fn.infer(env)
		if (!('fnType' in ty)) return ty

		/**
		 * A function type whose return type equals to All is type constructor
		 * (e.g. 'struct' function), so it should be evaluated to infer a type of
		 * the expression
		 */
		if (ty.fnType.out.isEqualTo(all)) {
			return this.eval(env).result
		}

		const [unifier] = this.#unify(env)
		return unifier.substitute(ty.fnType.out, true)
	}

	resolveSymbol = (path: string | number): Expr | null => {
		if (!this.fn) return null
		let index

		if (typeof path === 'string') {
			// NOTE: 実引数として渡された関数の方ではなく、仮引数の方で名前を参照するべきなので、
			// Env.globalのほうが良いのでは?
			const fnType = this.fn.infer(Env.global)
			if (fnType.type !== 'FnType') return null

			const paramNames = keys(fnType.params)
			index = paramNames.indexOf(path) + 1
			if (index <= 0) return null
		} else {
			index = path
		}

		// index begins like (fn=0 arg0=1 arg2=2 ...)
		return (index == 0 ? this.fn : this.args[index - 1]) ?? null
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			if (!this.fn) {
				this.extras = {delimiters: ['']}
			} else {
				const elementsCount = (this.fn ? 1 : 0) + this.args.length
				const delimiters = createListDelimiters(elementsCount)

				this.extras = {delimiters}
			}
		}

		// Print unit literal
		if (!this.fn) {
			return '(' + this.extras.delimiters[0] + ')'
		}

		const fn = this.fn.print(options)
		const args = this.args.map(a => a.print(options))

		const {delimiters} = this.extras

		return '(' + insertDelimiters([fn, ...args], delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: AnyExpr) =>
		this.type === expr.type && isEqualArray(this.args, expr.args, isSame)

	clone = (): App => new App(this.fn, ...this.args.map(clone))
}

export const app = (fn?: Expr, ...args: Expr[]) => new App(fn, ...args)

/**
 * AST representing scope expression
 */
export class Scope extends BaseExpr {
	readonly type = 'Scope' as const

	public readonly items: Record<string, Expr>
	public readonly out?: Expr

	constructor(items: Record<string, Expr> = {}, out?: Expr) {
		super()

		// Set parent
		forOwn(items, v => (v.parent = this))
		if (out) out.parent = this

		this.items = items
		this.out = out
	}

	protected forceInfer = (env: Env): Value => {
		return this.out?.infer(env) ?? unit
	}

	protected forceEval = (env: Env) => {
		return this.out?.eval(env) ?? Writer.of(unit)
	}

	resolveSymbol = (path: string | number): Expr | null => {
		if (typeof path === 'number') return null

		return this.items[path] ?? null
	}

	print = (options?: PrintOptions): string => {
		const varEntries = entries(this.items)

		if (!this.extras) {
			const tokensCount = 1 + varEntries.length * 2 + (this.out ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const items = varEntries.map(([k, v]) => [k + ':', v.print(options)]).flat()
		const out = this.out ? [this.out.print(options)] : []

		const {delimiters} = this.extras

		return '(' + insertDelimiters(['let', ...items, ...out], delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: AnyExpr) =>
		this.type === expr.type &&
		nullishEqual(this.out, expr.out, isSame) &&
		isEqualDict(this.items, expr.items, isSame)

	clone = (): Scope =>
		new Scope(mapValues(this.items, clone), this.out?.clone())

	extend(items: Record<string, Expr>, out?: Expr): Scope {
		const scope = new Scope(items, out)
		scope.parent = this
		return scope
	}

	def(name: string, expr: Expr) {
		if (name in this.items)
			throw new Error(`Variable '${name}' is already defined`)

		expr.parent = this
		this.items[name] = expr

		return this
	}

	defs(items: Record<string, Expr>) {
		for (const [name, exp] of entries(items)) {
			this.def(name, exp)
		}
	}
}
export const scope = (items?: Record<string, Expr>, ret?: Expr) =>
	new Scope(items, ret)

export class ValueMeta extends BaseExpr {
	readonly type = 'ValueMeta' as const

	extras?: {delimiters: [string, string]}

	constructor(public readonly fields: Expr, public readonly expr: Expr) {
		super()

		// Set parent
		fields.parent = this
		expr.parent = this
	}

	protected forceEval = (env: Env): WithLog<Value> => {
		const [_fields, fieldLog] = this.fields.eval(env).asTuple
		const [_expr, exprLog] = this.expr.eval(env).asTuple

		let fields = _fields,
			expr = _expr

		const metaLog = new Set<Log>()

		// Check if the metadata is dictionary
		if (fields.type !== 'Dict') {
			// NOTE: これ、inferした時点でDictじゃなければ切る、でも良いのでは?
			metaLog.add({
				level: 'warn',
				ref: this,
				reason: `Type metadata should be dictionary, but got ${fields.type}`,
			})

			// Just returns a value with logs
			return withLog(expr, ...exprLog, ...metaLog)
		}

		// When the default key exists
		const defaultValue = fields.items.default
		if (defaultValue) {
			fields = fields.clone()
			delete fields.items.default

			expr = expr.withMeta(fields)

			// Check if the default value is valid
			if (expr.isTypeFor(defaultValue)) {
				expr = expr.withDefault(defaultValue)
			} else {
				metaLog.add({
					level: 'warn',
					ref: this,
					reason:
						`Cannot use ${defaultValue.print()} ` +
						`as a default value of ${expr.print()}`,
				})
			}
		}

		return withLog(expr, ...fieldLog, ...exprLog, ...metaLog)
	}

	protected forceInfer = (env: Env) => {
		return this.expr.infer(env)
	}

	resolveSymbol = () => {
		throw new Error('Cannot resolve any symbol in withMeta expression')
	}

	clone = (): ValueMeta => new ValueMeta(this.fields.clone(), this.expr.clone())

	isSameTo = (expr: AnyExpr): boolean => {
		return (
			this.type === expr.type &&
			this.fields.isSameTo(expr.fields) &&
			this.expr.isSameTo(expr.expr)
		)
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			this.extras = {delimiters: ['', '']}
		}

		const [d0, d1] = this.extras.delimiters
		const fields = this.fields.print(options)
		const expr = this.expr.print(options)

		return `^${d0}${fields}${d1}${expr}`
	}
}

/**
 * Alias of ValueMeta constructor
 */
export const valueMeta = (meta: Expr, value: Expr) => new ValueMeta(meta, value)

/*
export class NodeMeta {
	readonly type = 'NodeMeta' as const

	public attachedTo!: Expr

	constructor(
		public fields: DictLiteral,
		public extras?: {delimiter: string}
	) {}

	eval = this.fields.eval

	print = (options?: PrintOptions) => {
		if (!this.extras) {
			this.extras = {delimiter: ''}
		}

		const fields = this.fields.print(options)

		return this.extras.delimiter + '#' + fields
	}

	isSame = (expr: NodeMeta) {
		return this.fields.isSameTo(b.fields)
	}
}
*/

export function isSame(a: Expr, b: Expr): boolean {
	return a.isSameTo(b)
}

export function print(expr: Expr, options?: PrintOptions) {
	return expr.print(options)
}

export function clone(expr: Expr) {
	return expr.clone()
}

import EventEmitter from 'eventemitter3'
import {IterableWeakSet} from 'iterable-weak'
import {entries, forOwn, keys, mapValues, values} from 'lodash'
import ordinal from 'ordinal'

import {EvalError} from '../EvalError'
import {Log} from '../Log'
import {fromKeysValues} from '../util/fromKeysValues'
import {getKeyByValue} from '../util/getKeyByValue'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {nullishEqual} from '../util/nullishEqual'
import {union} from '../util/SetOperation'
import {
	All,
	all,
	Dict,
	dict,
	differenceType,
	Fn,
	FnType,
	IFn,
	Meta,
	never,
	number,
	string,
	TypeVar,
	unionType,
	unit,
	Value,
	vec,
} from '../value'
import {Action} from './action'
import {changedExprs, editedExprs, evaluatingExprs, inferringExprs} from './dep'
import {Env} from './env'
import {FailedResolution} from './FailedResolution'
import {Key, Path} from './path'
import {
	createListDelimiters,
	increaseDelimiter,
	insertDelimiters,
	removeDelimiter,
} from './PrintUtil'
import {shadowTypeVars, Unifier} from './unify'

export {notifyChangedExprs} from './dep'
export type {Action} from './action'
export * from './computeSymbol'

/**
 * ASTs that have eval, infer as normal
 */
export type Expr = Exclude<Exclude<AnyExpr, ParamsDef>, TypeVarsDef>

/**
 * Presenting any ASTs
 */
export type AnyExpr = AtomExpr | ParentExpr

/**
 * ASTs that cannot have child elements
 */
export type AtomExpr = Symbol | Container | Literal | InfixNumber

/**
 * expressions that can contain other experssions
 */
export type ParentExpr = InnerExpr | UtilExpr

/**
 * An internal node used to resolve a symbol
 */
export type InnerExpr = App | Scope | Match | FnDef | VecLiteral | DictLiteral

/**
 * An expression that is generally ignored from a hierarchy on symbol resolution
 */
type UtilExpr = ValueMeta | ParamsDef | TypeVarsDef | Program | TypeSignature

function isUtilExpr(expr: AnyExpr): expr is UtilExpr {
	return (
		expr.type === 'Program' ||
		expr.type === 'ValueMeta' ||
		expr.type === 'ParamsDef' ||
		expr.type === 'TypeVarDef' ||
		expr.type === 'TypeSignature'
	)
}

export interface PrintOptions {
	omitMeta?: boolean
}

interface ExprEventTypes {
	change: () => void
	edit: () => void
}

/**
 * Base class for all kind of ASTs
 */
export abstract class BaseExpr extends EventEmitter<ExprEventTypes> {
	abstract readonly type: string

	parent: ParentExpr | null = null

	get innerParent(): InnerExpr | null {
		let expr: AnyExpr | null = this.parent
		while (expr) {
			if (!isUtilExpr(expr)) break
			expr = expr.parent
		}

		return expr
	}

	/**
	 * 現在の式の評価値が変わることで、再評価が必要になる式
	 */
	evalDep = new IterableWeakSet<BaseExpr>()

	/**
	 * 現在の式の評価値が変わることで、再度型推論が必要になる式
	 */
	inferDep = new IterableWeakSet<BaseExpr>()

	/**
	 * シンボル解決中、現在の式に存在しないキーを参照された場合に、そのキーと参照元のシンボルの対を記録する
	 * 将来的に現在の式が編集されそのキーがvalidなものとなった際に、シンボルを再評価する
	 * TODO: 値を弱参照にする
	 */
	failedResolution = new FailedResolution()

	evalCache = new WeakMap<Env, Value>()
	inferCache = new WeakMap<Env, Value>()

	abstract print(options?: PrintOptions): string

	protected abstract forceEval(env: Env): Value

	protected abstract forceInfer(env: Env): Value

	// eslint-disable-next-line no-unused-vars
	get(key: Key): Expr | null {
		return null
	}

	/**
	 * 編集関数
	 * @see https://scrapbox.io/guiland/%E9%80%86%E6%93%8D%E4%BD%9C%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89
	 * @returns 逆操作コマンド
	 */
	commit(action: Action): Action {
		if (action.type === 'set') {
			return this.set(action.path, action.expr)
		} else if (action.type === 'delete') {
			return this.delete(action.path)
		} else if (action.type === 'rename') {
			return this.rename(action.path, action.to)
		} else if (action.type === 'insert') {
			return this.insert(action.path, action.expr)
		} else {
			throw new Error('Not yet supported')
		}
	}

	// eslint-disable-next-line no-unused-vars
	set(key: Key, expr: Expr): Action {
		throw new Error(`Invalid call of set on \`${this.print()}\``)
	}

	// eslint-disable-next-line no-unused-vars
	delete(key: Key): Action {
		throw new Error(`Invalid call of delete on \`${this.print()}\``)
	}

	// eslint-disable-next-line no-unused-vars
	rename(key: Key, to: string): Action {
		throw new Error(`Invalid call of rename on \`${this.print()}\``)
	}

	// eslint-disable-next-line no-unused-vars
	insert(key: Key, expr: Expr): Action {
		throw new Error(`Invalid call of insert on \`${this.print()}\``)
	}

	// eslint-disable-next-line no-unused-vars
	getKey(expr: Expr): Key | null {
		return null
	}

	protected dispatchEditEvents() {
		// Emit 'edit' events
		let e: BaseExpr | ParamsDef | TypeVarsDef | null = this
		do {
			if (e instanceof EventEmitter) {
				editedExprs.add(e)
			}
		} while ((e = e.parent))
	}

	/**
	 * 式が全く同じ構造かどうかを比較する
	 * メタデータ、シンボルの記法等は区別する
	 * デリミタ、数値リテラルの表記ゆれ、辞書式の順序は区別しない
	 * 主にパーサーのテストコード用
	 */
	abstract isSameTo(expr: AnyExpr): boolean

	abstract clone(): AnyExpr

	eval(env = Env.global): Value {
		const evalCallee = evaluatingExprs.callee
		if (evalCallee) {
			this.evalDep.add(evalCallee)
		}
		const inferCallee = inferringExprs.callee
		if (inferCallee) {
			this.inferDep.add(inferCallee)
		}

		let cache = this.evalCache.get(env)

		if (!cache) {
			if (evaluatingExprs.has(this)) {
				return unit.withLog({
					level: 'error',
					reason: 'Circular reference detected',
					ref: this as any as Expr,
				})
			}

			try {
				evaluatingExprs.push(this)
				cache = this.forceEval(env)
				const log = cache.log
				evaluatingExprs.pushLog(log)
				inferringExprs.pushLog(log)
			} finally {
				const log = evaluatingExprs.pop()
				if (cache) {
					cache.log = union(cache.log, log)
				}
			}

			cache.source = this as any as Expr

			this.evalCache.set(env, cache)
		}

		return cache
	}

	infer(env = Env.global): Value {
		const inferCallee = inferringExprs.callee
		if (inferCallee) {
			this.inferDep.add(inferCallee)
		}

		let cache = this.inferCache.get(env)

		if (!cache) {
			if (inferringExprs.has(this)) {
				return unit.withLog({
					level: 'error',
					reason: 'Circular reference detected',
					ref: this as any as Expr,
				})
			}

			try {
				inferringExprs.push(this)
				cache = this.forceInfer(env)
				const log = cache.log
				evaluatingExprs.pushLog(log)
				inferringExprs.pushLog(log)
			} finally {
				const log = inferringExprs.pop()
				if (cache) {
					cache.log = union(cache.log, log)
				}
			}

			this.inferCache.set(env, cache)
		}

		return cache
	}

	clearCache() {
		this.#clearEvalCache()
		this.#clearInferCache()
	}

	#clearEvalCache() {
		changedExprs.add(this)
		this.evalCache.delete(Env.global)
		this.evalDep.forEach(e => e.#clearEvalCache())
	}

	#clearInferCache() {
		this.inferCache.delete(Env.global)
		this.inferDep.forEach(e => e.#clearInferCache())
	}
}

/**
 * AST representing parsed expression with preserving spaces around it.
 * Also used to represent empty input (only whitespaces, delimiters, comments)
 */
export class Program extends BaseExpr {
	readonly type = 'Program' as const

	constructor(
		public before: string,
		public expr?: Expr,
		public after: string = ''
	) {
		super()
		if (this.expr) this.expr.parent = this
	}

	protected forceEval(env: Env) {
		if (!this.expr) {
			return unit.withLog({
				level: 'error',
				reason: 'Empty program',
			})
		}
		return this.expr.eval(env)
	}

	protected forceInfer(env: Env) {
		if (!this.expr) return unit
		return this.expr.infer(env)
	}

	print(options?: PrintOptions): string {
		if (this.expr) {
			return this.before + this.expr.print(options) + this.after
		} else {
			return this.before + this.after
		}
	}

	clone(): Program {
		return new Program(this.before, this.expr?.clone(), this.after)
	}

	isSameTo(expr: AnyExpr): boolean {
		if (this.type !== expr.type) return false
		return nullishEqual(this.expr, expr.expr, isSame)
	}
}

type ResolveResult =
	| {type: 'global' | 'param'; expr: Expr}
	| {type: 'arg'; value: Value}
	| Log

/**
 * AST representing any identifier
 */
export class Symbol extends BaseExpr {
	readonly type = 'Symbol' as const

	public readonly paths: readonly Path[]
	public readonly props: readonly Key[]

	constructor(
		pathArrayOrPath: readonly Path[] | Path,
		propArrayOrProp: Key[] | Key = []
	) {
		super()

		const paths: Path[] = Array.isArray(pathArrayOrPath)
			? pathArrayOrPath
			: [pathArrayOrPath]

		if (paths.length === 0) {
			throw new Error('Zero-length path cannot be set to a new Symbol')
		}

		const props: Key[] = Array.isArray(propArrayOrProp)
			? propArrayOrProp
			: [propArrayOrProp]

		this.paths = paths
		this.props = props
	}

	resolve(env: Env = Env.global): ResolveResult {
		let expr: Expr | null = this.innerParent
		let isFirstPath = true

		for (let i = 0; i < this.paths.length; i++) {
			const path = this.paths[i]
			const isLastPath = i === this.paths.length - 1

			if (!expr) {
				return {
					level: 'error',
					reason: `Symbol \`${this.print()}\` cannot be resolved`,
					ref: this,
				}
			}

			if (path === '..') {
				expr = expr.innerParent
			} else if (path === '.') {
				// Do nothing
			} else {
				// typeof path === Key
				if (!isFirstPath) {
					const e: Expr | null = expr.get(path)
					if (e) {
						expr = e
					} else {
						expr.failedResolution.set(path, this)
						expr = null
					}
				} else {
					while (expr) {
						if (expr.type === 'Scope' || expr.type === 'Match') {
							const e: Expr | null = expr.get(path)
							if (e) {
								expr = e
								break
							} else {
								expr.failedResolution.set(path, this)
							}
						} else if (expr.type === 'FnDef') {
							const e = expr.get(path)
							if (e) {
								if (!isLastPath) {
									return {
										level: 'error',
										reason:
											`Symbol \`${this.print()}\` referring function parameter ` +
											'cannot be followed by any path',
										ref: this,
									}
								} else if (env.isGlobal) {
									return {type: 'param', expr: e}
								} else {
									// 型変数は環境にセットされないので、そのまま返す
									if (e.type === 'Container' && e.value.type === 'TypeVar') {
										return {type: 'arg', value: e.value}
									}

									const arg = env.getArg(path.toString())
									if (arg) {
										return {type: 'arg', value: arg}
									} else {
										throw new Error()
									}
								}
							} else {
								expr.failedResolution.set(path, this)
							}

							env = env.pop()
						}
						expr = expr.innerParent
					}
				}
			}

			isFirstPath = false
		}

		if (!expr) {
			return {
				level: 'error',
				reason: `Symbol \`${this.print()}\` cannot be resolved`,
				ref: this,
			}
		}

		return {type: 'global', expr}
	}

	protected forceEval(env: Env): Value {
		const resolved = this.resolve(env)

		if ('level' in resolved) {
			return unit.withLog(resolved)
		}

		let value: Value | null
		if (resolved.type === 'arg') {
			value = resolved.value
		} else {
			value = resolved.expr.eval(env)
		}

		// When the symbol is referring a parameter of function definition
		// during global context, thus it's a free variable and should return
		// the default value of parameter .
		if (resolved.type === 'param') {
			value = value.defaultValue.usesParamDefault()
		}

		// Accessing the properties of the evaluated value
		for (const key of this.props) {
			if (!value) break
			value = value.get(key)
		}

		if (!value) {
			return unit.withLog({
				level: 'error',
				reason: `Symbol \`${this.print()}\` cannot be resolved`,
				ref: this,
			})
		}

		return value
	}

	protected forceInfer(env: Env): Value {
		const resolved = this.resolve(env)

		if ('level' in resolved) {
			return unit.withLog(resolved)
		}

		let value: Value | null

		switch (resolved.type) {
			case 'global':
				value = resolved.expr.infer(env)
				break
			case 'param':
				value = resolved.expr.eval(env)
				break
			case 'arg':
				value = resolved.value
				break
		}

		// Accessing the properties of the value
		for (const prop of this.props) {
			if (!value) break
			value = value.getTypeFor(prop)
		}

		if (!value) {
			return unit.withLog({
				level: 'error',
				reason: `Symbol \`${this.print()}\` cannot be resolved`,
				ref: this,
			})
		}

		return value
	}

	print() {
		const paths = this.paths.join('/')
		const props = this.props.map(p => '.' + p).join('')

		if (paths.endsWith('.') && props !== '') {
			return paths + '/' + props
		} else {
			return paths + props
		}
	}

	isSameTo(expr: AnyExpr) {
		return this.type === expr.type && this.print() === expr.print()
	}

	clone() {
		return new Symbol(this.paths)
	}
}

export const symbol = (
	pathArrayOrPath: readonly Path[] | Path,
	propArrayOrProp?: Key[] | Key
) => {
	return new Symbol(pathArrayOrPath, propArrayOrProp)
}

/**
 * AST to directry store a value that cannot be parsed from string
 * e.g. DOM，Image
 */
export class Container<V extends Value = Value> extends BaseExpr {
	readonly type = 'Container' as const

	constructor(public readonly value: V) {
		super()
	}

	protected forceEval() {
		return this.value
	}

	protected forceInfer() {
		if (this.value.isType) return all
		if (this.value.type === 'Fn') return this.value.fnType
		return this.value
	}

	get() {
		return null
	}

	print(options?: PrintOptions) {
		const expr = this.value.toExpr()
		if (expr.type !== this.type) return expr.print(options)
		return `<Container of ${this.value.type}>`
	}

	isSameTo(expr: AnyExpr) {
		return this.type === expr.type && this.value === expr.value
	}

	clone() {
		return new Container(this.value)
	}
}

export const container = <V extends Value = Value>(value: V) =>
	new Container(value)

/**
 * AST representing numeric/string literal
 */
export class Literal extends BaseExpr {
	readonly type = 'Literal' as const

	constructor(public readonly value: number | string) {
		super()
	}

	protected forceEval() {
		return typeof this.value === 'number'
			? number(this.value)
			: string(this.value)
	}

	protected forceInfer() {
		return this.forceEval()
	}

	get() {
		return null
	}

	print() {
		if (!this.extras) {
			this.extras = {raw: this.value.toString()}
		}

		if (typeof this.value === 'number') {
			return this.extras.raw
		} else {
			return '"' + this.extras.raw + '"'
		}
	}

	isSameTo(expr: AnyExpr) {
		if (this.type !== expr.type) return false
		if (typeof this.value === 'number' && typeof expr.value === 'number') {
			return (
				this.value === expr.value || (isNaN(this.value) && isNaN(expr.value))
			)
		}
		return this.value === expr.value
	}

	clone() {
		return new Literal(this.value)
	}

	extras?: {raw: string}
}

export const literal = (value: number | string) => new Literal(value)

interface NativeFnBody {
	type: 'NativeFnBody'
	f: IFn
}

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
	public readonly body?: Expr | NativeFnBody

	constructor(
		typeVars?: TypeVarsDef | string[] | null,
		params?: ParamsDef | Record<string, Expr> | null,
		returnType?: Expr | null,
		body?: Expr | NativeFnBody | null
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
		if (this.typeVars) this.typeVars.parent = this
		this.params.parent = this
		if (this.returnType) this.returnType.parent = this
		if (this.body && this.body.type !== 'NativeFnBody') this.body.parent = this
	}

	protected forceEval(env: Env): FnType | Fn {
		// In either case, params need to be evaluated
		// Paramの評価時にenvをPushするのは、型変数をデフォルト値にさせないため
		const {params, rest} = this.params.forceEvalChildren(env.push())
		const {optionalPos} = this.params

		const log = new Set<Log>()

		if (this.body) {
			// Returns function
			let {body} = this

			// Infer the return type of function body
			const arg = {...params}
			if (rest) {
				arg[rest.name] = vec([], undefined, rest.value)
			}

			const innerEnv = env.push(arg)
			let returnType =
				body.type === 'NativeFnBody' ? never : body.infer(innerEnv)

			// When there's explicit notation for return type,
			// check if inferredReturnType <: returnType is true.
			// Otherwise, the function ignores all arguments and always returns
			// the default value of returnType
			let shouldReturnDefaultValue = false

			if (this.returnType) {
				const annotatedReturnType = this.returnType.eval(env)

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
			let f: IFn

			if (body.type === 'NativeFnBody') {
				f = body.f
			} else if (shouldReturnDefaultValue) {
				f = () => returnType.defaultValue
				body = returnType.defaultValue.toExpr()
			} else {
				const {names, restName} = this.params.getNames()
				const bodyExpr = body

				f = (...args: Value[]) => {
					const argDict = fromKeysValues(names, args)
					if (restName) {
						const restArgs = args.slice(names.length)
						argDict[restName] = vec(restArgs)
					}

					const innerEnv = env.push(argDict)

					return bodyExpr.eval(innerEnv)
				}
			}

			const fnType = new FnType(params, optionalPos, rest, returnType)

			const fn = new Fn(
				fnType,
				f,
				body.type !== 'NativeFnBody' ? body : undefined
			)

			return fn.withLog(...log)
		} else {
			// Returns a function type if there's no function body

			// Evaluates return type. Uses All type when no return type is defined.
			let returnType: Value = all
			if (this.returnType) {
				// The reason we need to call env.push() is to prevent any typeVar to be
				// evaluated as its default value (unit).
				returnType = this.returnType.eval(env.push())
			}

			const fnType = new FnType(params, optionalPos, rest, returnType)

			return fnType.withLog(...log)
		}
	}

	protected forceInfer(env: Env): FnType | All {
		// To be honest, I wanted to infer the function type
		// without evaluating it, but it works anyway and should be less buggy.
		const fn = this.eval(env)

		return fn.type === 'Fn'
			? fn.fnType // When the expression is function definition
			: all // Otherwise, the expression means function type definition
	}

	get(key: Key): Expr | null {
		if (typeof key === 'number') return null

		if (key === 'return') {
			if (!this.body || this.body.type === 'NativeFnBody') {
				return null
			} else {
				return this.body
			}
		}

		return this.typeVars?.get(key) ?? this.params.get(key)
	}

	getKey(expr: Expr): Key | null {
		const keyInParams = this.typeVars?.getKey(expr) ?? this.params.getKey(expr)

		if (keyInParams) {
			return keyInParams
		}

		if (expr === this.body) return 'return'

		return null
	}

	print(options?: PrintOptions): string {
		if (!this.extras) {
			const delimiters = ['', ' ']
			if (this.typeVars) delimiters.push(' ')
			if (this.returnType) delimiters.push('', ' ')
			if (this.body) delimiters.push(' ')

			delimiters.push('')

			this.extras = {delimiters}
		}

		const tokens: string[] = ['=>']

		if (this.typeVars) {
			tokens.push(this.typeVars.print())
		}

		// Params
		tokens.push(this.params.print(options))

		if (this.returnType) {
			tokens.push(':', this.returnType.print(options))
		}

		if (this.body) {
			if (this.body.type === 'NativeFnBody') {
				tokens.push('(js)')
			} else {
				tokens.push(this.body.print(options))
			}
		}

		return '(' + insertDelimiters(tokens, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			nullishEqual(this.typeVars, expr.typeVars, TypeVarsDef.isSame) &&
			this.params.isSameTo(expr.params) &&
			nullishEqual(this.returnType, expr.returnType, isSame) &&
			nullishEqual(
				this.body,
				expr.body,
				(a: Expr | NativeFnBody, b: Expr | NativeFnBody) => {
					if (a.type === 'NativeFnBody') {
						return b.type === 'NativeFnBody' && a.f === b.f
					} else {
						return b.type !== 'NativeFnBody' && a.isSameTo(b)
					}
				}
			)
		)
	}

	clone(): FnDef {
		const clonedBody = !this.body
			? null
			: this.body.type === 'NativeFnBody'
			? this.body
			: this.body.clone()

		return new FnDef(
			this.typeVars?.clone(),
			this.params.clone(),
			this.returnType?.clone() ?? null,
			clonedBody
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
	body?: Expr | NativeFnBody | null
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

	forceEvalChildren(env: Env) {
		const params = mapValues(this.items, it => it.eval(env))

		let rest: FnType['rest']
		if (this.rest) {
			const value = this.rest.expr.eval(env)
			rest = {name: this.rest.name, value}
		}

		return {params, rest}
	}

	get(key: Key): Expr | null {
		if (typeof key !== 'string') return null

		return this.items[key] ?? null
	}

	getKey(expr: Expr): Key | null {
		if (expr.parent !== this) return null
		return getKeyByValue(this.items, expr)
	}

	print(options?: PrintOptions) {
		const params = entries(this.items)
		const {optionalPos, rest} = this

		const paramsTokens = params
			.map(([name, value], i) => [
				(i < optionalPos ? '' : '?') + name + ':',
				value.print(options),
			])
			.flat()
		const restTokens = rest
			? [`...${rest.name}:`, rest.expr.print(options)]
			: []

		const tokens = [...paramsTokens, ...restTokens]

		if (!this.extras) {
			const delimiters = createListDelimiters(tokens.length)
			this.extras = {delimiters}
		}

		const {delimiters} = this.extras

		return '[' + insertDelimiters(tokens, delimiters) + ']'
	}

	extras?: {delimiters: string[]}

	clone() {
		return new ParamsDef(
			mapValues(this.items, clone),
			this.optionalPos,
			this.rest
				? {name: this.rest.name, expr: this.rest.expr.clone()}
				: undefined
		)
	}

	getNames() {
		return {
			names: keys(this.items),
			restName: this.rest?.name,
		}
	}

	isSameTo(expr: AnyExpr): boolean {
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
	readonly type = 'TypeVarDef' as const

	parent!: FnDef

	readonly typeVars: Record<string, Container<TypeVar>>

	constructor(readonly names: readonly string[]) {
		this.typeVars = {}

		for (const name of names) {
			const e = new Container(new TypeVar(name))
			e.parent = this
			this.typeVars[name] = e
		}
	}

	get(name: string): Container<TypeVar> | null {
		return this.typeVars[name] ?? null
	}

	getKey(key: Expr): Key | null {
		return getKeyByValue(this.typeVars, key)
	}

	print() {
		if (!this.extras) {
			const delimiters = createListDelimiters(this.names.length)
			this.extras = {delimiters}
		}

		return '(' + insertDelimiters(this.names, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	clone() {
		return new TypeVarsDef(this.names)
	}

	static isSame(a: TypeVarsDef, b: TypeVarsDef) {
		return isEqualArray(a.names, b.names)
	}
}

export class VecLiteral extends BaseExpr {
	readonly type = 'VecLiteral' as const

	public readonly items: Expr[]
	public optionalPos: number
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

	protected forceEval(env: Env): Value {
		const items = this.items.map(it => it.eval(env))
		const rest = this.rest?.eval(env)

		return vec(items, this.optionalPos, rest)
	}

	protected forceInfer(env: Env): Value {
		if (this.rest || this.items.length < this.optionalPos) {
			// When it's type
			return all
		}
		const items = this.items.map(it => it.infer(env))
		return vec(items)
	}

	get(key: Key): Expr | null {
		if (typeof key === 'string') return null

		return this.items[key] ?? null
	}

	getKey(expr: Expr): Key | null {
		return this.items.findIndex(it => it === expr) ?? null
	}

	set(key: Key, expr: Expr): Action {
		if (typeof key !== 'number') {
			throw new Error('Invalid path: ' + key)
		}

		// Allows path === items.length to push a new element
		if (key < 0 || this.items.length < key) {
			throw new Error('Index out of range')
		}

		const oldExpr = this.get(key)
		this.items[key] = expr
		expr.parent = this

		if (oldExpr) {
			oldExpr.clearCache()

			this.dispatchEditEvents()
			return {type: 'set', path: key, expr: oldExpr}
		} else {
			// When appended to the last element

			if (this.optionalPos === this.items.length - 1) {
				this.optionalPos++
			}

			if (this.extras) {
				increaseDelimiter(this.extras.delimiters)
			}

			this.failedResolution.clearCache(key)
			this.dispatchEditEvents()

			return {type: 'delete', path: key}
		}
	}

	delete(key: Key): Action {
		if (typeof key !== 'number') {
			throw new Error('Invalid path: ' + key)
		}

		if (key < 0 || this.items.length <= key) {
			throw new Error('Index out of range')
		}

		// 削除する要素とそれ以降の式に依存する式のキャッシュを削除
		this.items.slice(key).forEach(it => it.clearCache())

		const [deletedExpr] = this.items.splice(key, 1)

		if (key < this.optionalPos) {
			this.optionalPos--
		}

		if (this.extras) {
			const {delimiters} = this.extras
			delimiters.splice(key + 1, 1)
		}

		this.dispatchEditEvents()

		if (key === this.items.length) {
			return {type: 'set', path: key, expr: deletedExpr}
		} else {
			return {type: 'insert', path: key, expr: deletedExpr}
		}
	}

	insert(key: Key, expr: Expr): Action {
		if (typeof key !== 'number') {
			throw new Error('Invalid path: ' + key)
		}

		if (key < 0 || this.items.length < key) {
			throw new Error('Index out of range')
		}

		// 挿入する要素より後方の式に依存するキャッシュをクリア
		this.items.slice(key).forEach(it => it.clearCache())

		this.items.splice(key, 0, expr)

		if (key < this.optionalPos) {
			this.optionalPos++
		}

		if (this.extras) {
			increaseDelimiter(this.extras.delimiters)
		}

		// 新しく追加されたキー分のシンボルを再解決する
		this.failedResolution.clearCache(this.items.length - 1)

		this.dispatchEditEvents()

		return {type: 'delete', path: key}
	}

	print(options?: PrintOptions): string {
		if (!this.extras) {
			const elementsCount = this.items.length + (this.rest ? 1 : 0)
			const delimiters = createListDelimiters(elementsCount)

			this.extras = {delimiters}
		}

		const items = this.items.map(
			(it, i) => (this.optionalPos <= i ? '?' : '') + it.print(options)
		)
		const rest = this.rest ? ['...' + this.rest.print(options)] : []

		const {delimiters} = this.extras

		return '[' + insertDelimiters([...items, ...rest], delimiters) + ']'
	}

	extras?: {delimiters: string[]}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			isEqualArray(this.items, expr.items, isSame) &&
			this.optionalPos === expr.optionalPos &&
			nullishEqual(this.rest, this.rest, isSame)
		)
	}

	clone(): VecLiteral {
		return new VecLiteral(
			this.items.map(clone),
			this.optionalPos,
			this.rest?.clone()
		)
	}
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

	protected forceEval(env: Env): Value {
		const items = mapValues(this.items, it => it.eval(env))
		const rest = this.rest?.eval(env)
		return dict(items, this.optionalKeys, rest)
	}

	eval!: (env?: Env) => Dict

	protected forceInfer(env: Env): Value {
		if (this.optionalKeys.size > 0 || this.rest) {
			// When it's type
			return all
		}

		const items = mapValues(this.items, it => it.infer(env))
		return dict(items)
	}

	get(key: Key): Expr | null {
		if (typeof key === 'number') return null

		return this.items[key] ?? null
	}

	getKey(expr: Expr): Key | null {
		return getKeyByValue(this.items, expr)
	}

	print(options?: PrintOptions): string {
		const itemEntries = entries(this.items)

		if (!this.extras) {
			const tokensCount = itemEntries.length * 2 + (this.rest ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const itemTokens = entries(this.items)
			.map(([key, value]) => {
				const optionalMark = this.#isOptional(key) ? '?' : ''
				return [optionalMark + key + ':', value.print(options)]
			})
			.flat()

		const rest = this.rest ? ['...' + this.rest.print(options)] : []

		const {delimiters} = this.extras

		return '{' + insertDelimiters([...itemTokens, ...rest], delimiters) + '}'
	}

	extras?: {delimiters: string[]}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			isEqualDict(this.items, expr.items, isSame) &&
			isEqualSet(this.optionalKeys, expr.optionalKeys) &&
			nullishEqual(this.rest, expr.rest, isSame)
		)
	}

	clone(): DictLiteral {
		return new DictLiteral(
			mapValues(this.items, clone),
			this.optionalKeys,
			this.rest?.clone()
		)
	}
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

	fn?: Expr
	args: Expr[]

	constructor(fn?: Expr, ...args: Expr[]) {
		super()
		this.fn = fn
		this.args = args

		// Set parent
		if (fn) fn.parent = this
		args.forEach(a => (a.parent = this))
	}

	#unify(env: Env): [Unifier, Value[]] {
		if (!this.fn) throw new Error('Cannot unify unit literal')

		const fn = this.fn.eval(env)

		if (!('fnType' in fn)) return [new Unifier(), []]

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

		return [unifier, shadowedArgs]
	}

	protected forceEval(env: Env): Value {
		if (!this.fn) return unit

		// Evaluate the function itself at first
		const fn = this.fn.eval(env)

		// Check if it's not a function
		if (!('f' in fn)) {
			return fn
		}

		const fnType = fn.fnType

		// Start function application
		const names = keys(fnType.params)
		const params = values(fnType.params)

		// Unify FnType and args
		const [unifier, shadowedArgs] = this.#unify(env)
		const unifiedParams = params.map(p => unifier.substitute(p))
		const unifiedArgs = shadowedArgs.map(a => unifier.substitute(a))

		// Length-check of arguments
		const lenArgs = this.args.length
		const lenRequiredParams = fn.fnType.optionalPos

		const argLog = new Set<Log>()

		if (lenArgs < lenRequiredParams) {
			argLog.add({
				level: 'error',
				ref: this,
				reason: `Expected ${lenRequiredParams} arguments, but got ${lenArgs}`,
			})
		}

		// Check types of args and set them to default if necessary
		const args: Value[] = unifiedParams.map((pType, i) => {
			const aType = unifiedArgs[i] ?? unit
			const name = names[i]

			if (aType.isSubtypeOf(pType)) {
				// Type matched
				return this.args[i].eval(env)
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
							`${ord} argument \`${name}\` expects type \`${p}\`, ` +
							`but got \`${a}\`. ` +
							`Uses a default value \`${d}\` instead`,
					})
				}
				return pType.defaultValue
			}
		})

		// For rest argument
		if (fnType.rest) {
			const {name, value: pType} = fnType.rest

			for (let i = unifiedParams.length; i < this.args.length; i++) {
				const aType = unifiedArgs[i] ?? unit

				if (aType.isSubtypeOf(pType)) {
					// Type matched
					const a = this.args[i].eval(env)
					args.push(a)
				} else {
					// Type mismatched
					if (aType.type !== 'Unit') {
						const p = pType.print({omitMeta: true})
						const a = aType.print({omitMeta: true})
						argLog.add({
							level: 'error',
							ref: this,
							reason:
								`Rest argument \`${name}\` expects type \`${p}\`, ` +
								`but got \`${a}\`. ` +
								`Ignores the argument instead`,
						})
					}
				}
			}
		}

		// Call the function
		let result: Value
		try {
			result = fn.f(...args)
		} catch (err) {
			// 既に式への参照を持ったエラーであればそのまま上へ投げる
			if (err instanceof EvalError) {
				throw err
			}

			// 関数呼び出し中の場合、グローバル環境に抜けるまで無条件で投げ続ける
			if (!env.isGlobal) {
				throw err
			}

			// グローバル環境、かつ式への参照を持たない例外が投げられた場合、
			// 恐らくコヤツの関数適用が原因で投げられた例外ということなので、投げる
			const message = err instanceof Error ? err.message : 'Run-time error'
			throw new EvalError(this, message)
		}

		result = unifier.substitute(result, true)
		// result = result.withRef(this)

		return result.withLog(...argLog)
	}

	protected forceInfer(env: Env): Value {
		if (!this.fn) {
			// Unit literal
			return unit
		}

		const ty = this.fn.infer(env)
		if (!('fnType' in ty)) {
			return ty
		}

		const [unifier] = this.#unify(env)
		return unifier.substitute(ty.fnType.ret, true)
	}

	get(key: Key): Expr | null {
		if (!this.fn) return null
		let index: number

		if (typeof key === 'string') {
			if (key === '=>') {
				return this.fn
			}
			// NOTE: 実引数として渡された関数の方ではなく、仮引数の方で名前を参照するべきなので、
			// Env.globalのほうが良いのでは?
			const fnType = this.fn.infer()
			if (fnType.type !== 'FnType') return null

			const paramNames = keys(fnType.params)
			index = paramNames.indexOf(key) + 1
			if (index <= 0) return null
		} else {
			index = key
		}

		// index begins like (fn=0 arg0=1 arg2=2 ...)
		return (index === 0 ? this.fn : this.args[index - 1]) ?? null
	}

	getKey(expr: Expr): Key | null {
		if (expr === this.fn) {
			return '=>'
		}

		const index = this.args.findIndex(a => a === expr)
		if (index !== -1) {
			return index + 1
		} else {
			return null
		}
	}

	set(key: Key, newExpr: Expr): Action {
		const oldExpr = this.get(key)

		let index: number

		if (typeof key === 'string') {
			if (!this.fn) throw new Error('Invalid')

			const fnType = this.fn.infer()
			if (fnType.type !== 'FnType') throw new Error('Invalid')

			const paramNames = keys(fnType.params)
			index = paramNames.indexOf(key) + 1

			if (index <= 0) throw new Error('Invalid path:' + key)
		} else {
			index = key
		}

		if (index === 0) {
			this.fn = newExpr
		} else if (index <= this.args.length) {
			this.args[index - 1] = newExpr
		} else {
			throw new Error('Index exceeds')
		}

		newExpr.parent = this

		if (oldExpr) {
			oldExpr.clearCache()
			this.dispatchEditEvents()
			return {type: 'set', path: key, expr: oldExpr}
		} else {
			this.dispatchEditEvents()
			return {type: 'delete', path: key}
		}
	}

	print(options?: PrintOptions): string {
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

	isSameTo(expr: AnyExpr) {
		return this.type === expr.type && isEqualArray(this.args, expr.args, isSame)
	}

	clone(): App {
		return new App(this.fn, ...this.args.map(clone))
	}
}

export const app = (fn?: Expr, ...args: Expr[]) => new App(fn, ...args)

/**
 * AST representing scope expression
 */
export class Scope extends BaseExpr {
	readonly type = 'Scope' as const

	public items: Record<string, Expr>
	public ret: Expr | null

	constructor(items: Record<string, Expr> = {}, ret: Expr | null = null) {
		super()

		// Set parent
		forOwn(items, v => (v.parent = this))
		if (ret) ret.parent = this

		this.items = items
		this.ret = ret
	}

	protected forceInfer(env: Env): Value {
		return this.ret ? this.ret.infer(env) : unit
	}

	protected forceEval(env: Env) {
		return this.ret ? this.ret.eval(env) : unit
	}

	get(key: Key): Expr | null {
		if (typeof key === 'number') return null

		if (key === 'return') {
			return this.ret ?? null
		} else {
			return this.items[key] ?? null
		}
	}

	getKey(expr: Expr): Key | null {
		const keyInVars = getKeyByValue(this.items, expr)
		return keyInVars ?? (this.ret === expr ? 'return' : null)
	}

	set(key: Key, newExpr: Expr): Action {
		const oldExpr = this.get(key)

		if (key === 'return') {
			this.ret = newExpr
		} else {
			this.items[key] = newExpr
		}

		newExpr.parent = this

		if (oldExpr) {
			oldExpr.clearCache()
			this.dispatchEditEvents()
			return {type: 'set', path: key, expr: oldExpr}
		} else {
			if (this.extras) {
				increaseDelimiter(this.extras.delimiters)
				if (key !== 'return') {
					increaseDelimiter(this.extras.delimiters)
				}
			}

			this.failedResolution.clearCache(key)
			this.dispatchEditEvents()
			return {type: 'delete', path: key}
		}
	}

	delete(key: Key): Action {
		const oldExpr = this.get(key)

		if (!oldExpr) throw new Error('Invalid action')

		let index: number
		const names = keys(this.items)

		if (key === 'return') {
			this.ret = null
			index = names.length + 1
		} else {
			delete this.items[key]
			index = names.indexOf(key as string) + 1
		}

		oldExpr.clearCache()

		if (this.extras) {
			removeDelimiter(this.extras.delimiters, index)
			if (key !== 'return') {
				removeDelimiter(this.extras.delimiters, index)
			}
		}

		this.dispatchEditEvents()
		return {type: 'set', path: key, expr: oldExpr}
	}

	rename(key: Key, to: string): Action {
		if (key === 'return' || to === 'return') {
			throw new Error('return expression cannot be renamed')
		}

		if (typeof key === 'number') {
			throw new Error('Invalid rename path')
		}

		if (this.items[to]) {
			throw new Error('Already exists')
		}

		const expr = this.items[key]

		if (!expr) throw new Error('Invalid action')

		delete this.items[key]
		this.items[to] = expr

		expr.clearCache()

		this.failedResolution.clearCache(to)

		this.dispatchEditEvents()

		return {type: 'rename', path: to, to: key}
	}

	print(options?: PrintOptions): string {
		const varEntries = entries(this.items)

		if (!this.extras) {
			const tokensCount = 1 + varEntries.length * 2 + (this.ret ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const items = varEntries.map(([k, v]) => [k + ':', v.print(options)]).flat()
		const ret = this.ret ? [this.ret.print(options)] : []

		const {delimiters} = this.extras

		return '(' + insertDelimiters(['let', ...items, ...ret], delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo(expr: AnyExpr) {
		return (
			this.type === expr.type &&
			nullishEqual(this.ret, expr.ret, isSame) &&
			isEqualDict(this.items, expr.items, isSame)
		)
	}

	clone(): Scope {
		return new Scope(mapValues(this.items, clone), this.ret?.clone())
	}

	extend(items: Record<string, Expr>, ret?: Expr): Scope {
		const scope = new Scope(items, ret)
		scope.parent = this
		return scope
	}

	defs(pairs: Record<string, Expr>) {
		this.items = {...this.items}

		for (const [name, expr] of entries(pairs)) {
			expr.parent = this
			this.items[name] = expr
		}

		delete this.extras
	}
}
export const scope = (items?: Record<string, Expr>, ret?: Expr) =>
	new Scope(items, ret)

/**
 * AST representing match expression
 * (match captureName: expr ;; expr is omittable
 *        case1: then1
 *        case2: then2
 *        default ;; omittable
 */
export class Match extends BaseExpr {
	readonly type = 'Match' as const

	public readonly captureName: string
	public readonly subject: Expr
	public readonly cases: [Expr, Expr][]
	public readonly otherwise?: Expr

	constructor(
		captureName: string,
		subject: Expr,
		cases?: [Expr, Expr][],
		otherwise?: Expr
	) {
		super()

		this.captureName = captureName

		this.subject = subject
		this.subject.parent = this

		this.cases = cases ?? []
		for (const [pattern, then] of this.cases) {
			pattern.parent = this
			then.parent = this
		}

		if (otherwise) {
			this.otherwise = otherwise
			this.otherwise.parent = this
		}
	}

	protected forceEval(env: Env): Value {
		// First, evaluate the capture expression
		const subject = this.subject.eval(env)

		// Try to match the pattern in order
		// and evaluate ret expression if matched
		for (const [pattern, then] of this.cases) {
			if (subject.isSubtypeOf(pattern.eval(env))) {
				return then.eval(env)
			}
		}

		if (this.otherwise) {
			return this.otherwise.eval(env)
		}

		return unit.withLog({
			level: 'error',
			reason: 'No pattern has matched',
			ref: this,
		})
	}

	protected forceInfer(env: Env): Value {
		let type: Value = never
		let remainingSubjectType = this.subject.infer(env)

		for (const [_pattern, _then] of this.cases ?? []) {
			const pattern = _pattern.eval(env)
			const then = _then.infer(env)

			type = unionType(type, then)
			remainingSubjectType = differenceType(remainingSubjectType, pattern)
		}

		if (this.otherwise) {
			type = unionType(type, this.otherwise.infer(env))
			remainingSubjectType = never
		}

		if (!remainingSubjectType.isEqualTo(never)) {
			type = unionType(type, unit)
		}

		return type
	}

	get(key: Key): Expr | null {
		if (typeof key === 'string') {
			if (key === this.captureName) {
				return this.subject
			}
		}

		return null
	}

	extras?: {delimiters: string[]}

	print(options?: PrintOptions): string {
		const tokens = [
			'match',
			this.captureName + ':',
			this.subject.print(options),
		]

		// Cases part
		for (const [pattern, ret] of this.cases) {
			tokens.push(pattern.print(options) + ':', ret.print(options))
		}

		// Otherwise part
		if (this.otherwise) {
			tokens.push(this.otherwise.print(options))
		}

		if (!this.extras) {
			this.extras = {delimiters: createListDelimiters(tokens.length)}
		}

		return '(' + insertDelimiters(tokens, this.extras.delimiters) + ')'
	}

	clone(): Match {
		return new Match(this.captureName, this.subject, this.cases, this.otherwise)
	}

	isSameTo(expr: AnyExpr | Match): boolean {
		if (this.type !== expr.type) return false

		return (
			this.captureName === expr.captureName &&
			this.subject.isSameTo(expr.subject) &&
			isEqualArray(
				this.cases,
				expr.cases,
				(a, b) => a[0].isSameTo(b[0]) && a[1].isSameTo(b[1])
			) &&
			nullishEqual(this.otherwise, expr.otherwise, isSame)
		)
	}
}

export const match = (
	captureName: string,
	subject: Expr,
	cases?: [Expr, Expr][],
	otherwise?: Expr
) => new Match(captureName, subject, cases, otherwise)

export class InfixNumber extends BaseExpr {
	readonly type = 'InfixNumber' as const

	public readonly args: number[]

	constructor(public readonly op: string, ...args: number[]) {
		super()

		if (args.length === 0) {
			throw new Error('Invalid zero-length arguments')
		}

		if (args.some(a => !isFinite(a))) {
			throw new Error('Non-finite numbers cannot be used in InfixNumber')
		}

		this.args = args
	}

	protected forceEval(env: Env): Value {
		const args = this.args.map(a => new Literal(a))

		const app = new App(new Symbol(['$' + this.op]), ...args)
		app.parent = this.parent

		return app.eval(env)
	}

	protected forceInfer(env: Env): Value {
		const args = this.args.map(a => new Literal(a))

		const app = new App(new Symbol(['$' + this.op]), ...args)
		app.parent = this.parent

		return app.infer(env)
	}

	get() {
		return null
	}

	extras?: {raw: string[]}

	print() {
		if (!this.extras) {
			this.extras = {raw: this.args.map(a => a.toString())}
		}

		if (this.extras.raw.length === 1) {
			return this.extras.raw[0] + this.op
		} else {
			return this.extras.raw.join(this.op)
		}
	}

	clone() {
		return new InfixNumber(this.op, ...this.args)
	}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			this.op === expr.op &&
			isEqualArray(this.args, expr.args)
		)
	}
}

export const infix = (op: string, ...args: number[]) => {
	return new InfixNumber(op, ...args)
}

export class TypeSignature extends BaseExpr {
	readonly type = 'TypeSignature' as const

	constructor(
		public readonly body: Exclude<Expr, TypeSignature>,
		public readonly signature: Exclude<Expr, TypeSignature>
	) {
		super()

		body.parent = this
		signature.parent = this
	}

	protected forceEval(env: Env): Value {
		const evaluated = this.body.eval(env)
		const type = this.signature.eval(env)

		if (type.isTypeFor(evaluated)) {
			return evaluated
		} else {
			return type.defaultValue.withLog({
				level: 'error',
				ref: this,
				reason: `\`${evaluated.print()}\` is not a value of type \`${type.print()}\``,
			})
		}
	}

	protected forceInfer(env: Env): Value {
		return this.signature.eval(env)
	}

	extras?: {delimiters: [string, string]}

	print(options?: PrintOptions): string {
		if (!this.extras) {
			this.extras = {delimiters: ['', '']}
		}

		const [_0, _1] = this.extras.delimiters

		return (
			this.body.print(options) + _0 + '::' + _1 + this.signature.print(options)
		)
	}

	clone() {
		return new TypeSignature(this.body, this.signature)
	}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			this.body.isSameTo(expr.body) &&
			this.signature.isSameTo(expr.signature)
		)
	}
}

export class ValueMeta extends BaseExpr {
	readonly type = 'ValueMeta' as const

	extras?: {delimiters: [string, string]}

	constructor(public readonly fields: Expr, public readonly expr: Expr) {
		super()

		// Set parent
		fields.parent = this
		expr.parent = this
	}

	protected forceEval(env: Env): Value {
		const fields = this.fields.eval(env)
		let value = this.expr.eval(env)

		const log = new Set<Log>()

		// Check if the metadata is dictionary
		if (fields.type !== 'Dict') {
			// NOTE: これ、inferした時点でDictじゃなければ切る、でも良いのでは?
			// Just returns a value with logs
			return value.withLog({
				level: 'error',
				ref: this,
				reason:
					'Type metadata should be a dictionary, ' +
					`but got \`${fields.type}\``,
			})
		}

		const meta: Meta = {...fields.items}

		// When the default key exists
		const defaultValue = meta.default
		if (defaultValue) {
			// Check if the default value is valid
			if (value.isTypeFor(defaultValue)) {
				value = value.withDefault(defaultValue)
			} else {
				log.add({
					level: 'error',
					ref: this,
					reason:
						`Cannot use ${defaultValue.print()} ` +
						`as a default value of ${value.print()}`,
				})
			}
			delete meta.default
		}

		value = value.withMeta(meta)

		return value.withLog(...log)
	}

	protected forceInfer(env: Env): Value {
		return this.expr.infer(env)
	}

	get(): null {
		throw new Error('Cannot resolve any symbol in withMeta expression')
	}

	clone(): ValueMeta {
		return new ValueMeta(this.fields.clone(), this.expr.clone())
	}

	isSameTo(expr: AnyExpr): boolean {
		return (
			this.type === expr.type &&
			this.fields.isSameTo(expr.fields) &&
			this.expr.isSameTo(expr.expr)
		)
	}

	print(options?: PrintOptions): string {
		if (options?.omitMeta) {
			return this.expr.print(options)
		}

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

export function isSame(a: Expr, b: Expr): boolean {
	return a.isSameTo(b)
}

export function clone(expr: Expr) {
	return expr.clone()
}

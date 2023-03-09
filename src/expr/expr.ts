import {entries, forOwn, fromPairs, keys, mapValues, values} from 'lodash'
import ordinal from 'ordinal'

import {GlispError} from '../GlispError'
import {Log, WithLog, withLog} from '../log'
import {isEqualArray} from '../util/isEqualArray'
import {isEqualDict} from '../util/isEqualDict'
import {isEqualSet} from '../util/isEqualSet'
import {nullishEqual} from '../util/nullishEqual'
import {union} from '../util/SetOperation'
import {Writer} from '../util/Writer'
import {zip} from '../util/zip'
import {
	All,
	all,
	Dict,
	dict,
	fnFrom,
	FnType,
	fnType,
	IFn,
	num,
	str,
	TypeVar,
	typeVar,
	unionType,
	Unit,
	unit,
	Value,
	vec,
} from '../value'
import {Env} from './env'
import {createListDelimiters, insertDelimiters} from './PrintUtil'
import {shadowTypeVars, Unifier} from './unify'

export type Expr = LeafNode | InnerNode

/**
 * ASTs that cannot have child elements
 */
export type LeafNode = Identifier | ValueContainer | NumLiteral | StrLiteral

/**
 * ASTs that can have child elements
 */
export type InnerNode =
	| App
	| Scope
	| TryCatch
	| FnDef
	| VecLiteral
	| DictLiteral
	| ValueMeta

/**
 * expressions that can contain other experssions
 */
export type ParentNode = InnerNode | ValueMeta | NodeMeta | ParamsDef

export type Arg<T extends Value = Value> = () => T

export interface PrintOptions {
	omitMeta?: boolean
}

/**
 * Base class for all kind of ASTs
 */
export abstract class BaseExpr {
	abstract readonly type: string

	parent: ParentNode | null = null

	abstract print(options?: PrintOptions): string

	protected abstract forceEval(env: Env): WithLog
	protected abstract forceInfer(env: Env): WithLog

	/**
	 * 式が全く同じ構造かどうかを比較する
	 * メタデータ、シンボルの記法等は区別する
	 * デリミタ、数値リテラルの表記ゆれ、辞書式の順序は区別しない
	 * 主にパーサーのテストコード用
	 */
	abstract isSameTo(expr: Expr): boolean

	abstract clone(): Expr

	#nodeMeta?: NodeMeta

	setNodeMeta(meta: NodeMeta) {
		this.#nodeMeta = meta
		this.#nodeMeta.attachedTo = this as any
		return this
	}

	eval(env = Env.global) {
		return env.memoizeEval(this, this.forceEval)
	}

	infer(env = Env.global) {
		return env.memoizeInfer(this, this.forceInfer)
	}

	getLog = () => this.eval(Env.global).log
}

export class Identifier extends BaseExpr {
	readonly type = 'Identifier' as const

	constructor(public readonly name: string) {
		super()
	}

	#resolve(
		ref: Expr | ValueMeta | NodeMeta | ParamsDef | null,
		env: Env
	): Writer<{expr: Expr; mode?: 'param' | 'arg' | 'TypeVar'}, Log> {
		if (!ref) {
			// If the expr has no parent and still couldn't resolve the symbol,
			// assume there's no bound expression for it.
			const log: Log = {
				level: 'error',
				ref: this,
				reason: 'Variable not bound: ' + this.name,
			}

			return Writer.of({expr: new App()}, log)
		}

		if (ref.type === 'Scope') {
			if (this.name in ref.items) {
				return Writer.of({expr: ref.items[this.name]})
			}
		}

		if (ref.type === 'FnDef') {
			if (env.isGlobal) {
				// Situation A. While normal evaluation
				const res = ref.params.get(this.name, env)
				if (res) {
					const [expr, l] = res.asTuple
					return Writer.of({expr, mode: 'param'}, ...l)
				}
			} else {
				// Situation B. In a context of function appliction
				const arg = env.get(this.name)
				if (arg) {
					return Writer.of({expr: new ValueContainer(arg()), mode: 'arg'})
				}
			}
			// If no corresponding arg has found for the fn, pop the env.
			env = env.pop()
		}

		// Resolve typeVars
		if (ref.type === 'FnDef') {
			const tv = ref.typeVars?.get(this.name)
			if (tv) {
				return Writer.of({
					expr: new ValueContainer(tv),
					mode: 'TypeVar',
				})
			}
		}

		// On meta
		if (ref.type === 'NodeMeta') {
			return this.#resolve(ref.attachedTo, env)
		}

		// Resolve with parent node recursively
		return this.#resolve(ref.parent, env)
	}

	protected forceEval = (env: Env): WithLog => {
		return this.#resolve(this.parent, env).bind(({expr, mode}) => {
			const result = expr.eval(env)

			return mode === 'param' ? result.fmap(v => v.defaultValue) : result
		})
	}

	protected forceInfer = (env: Env): WithLog => {
		const resolved = this.#resolve(this.parent, env)

		if (resolved.result.mode) {
			// In cases such as inferring `x` in `(=> [x:(+ 1 2)] x)`,
			// The type of parameter `(+ 1 2)` needs to be *evaluated*
			return resolved.result.expr.eval(env)
		} else {
			// othersise, infer it as usual
			return resolved.bind(({expr}) => expr.infer(env))
		}
	}

	print = () => this.name

	isSameTo = (expr: Expr) => this.type === expr.type && this.name === expr.name

	clone = () => new Identifier(this.name)
}

/**
 * AST to store values that cannot be parsed from strings
 * e.g. DOM，Image
 */
export class ValueContainer<V extends Value = Value> extends BaseExpr {
	readonly type = 'ValueContainer' as const

	constructor(public readonly value: V) {
		super()
	}

	protected forceEval = () => withLog(this.value)

	protected forceInfer = () => withLog(this.value.isType ? all : this.value)

	print = (options?: PrintOptions) => {
		const expr = this.value.toExpr()
		if (expr.type !== this.type) return expr.print(options)
		return `<value container of ${this.value.type}>`
	}

	isSameTo = (expr: Expr) =>
		this.type === expr.type && this.value === expr.value

	clone = () => new ValueContainer(this.value)
}

export class NumLiteral extends BaseExpr {
	readonly type = 'NumLiteral' as const

	constructor(public readonly value: number) {
		super()
	}

	protected forceEval = () => withLog(num(this.value))

	protected forceInfer = () => withLog(num(this.value))

	print = () => {
		if (!this.extras) {
			this.extras = {raw: this.value.toString()}
		}

		return this.extras.raw
	}

	isSameTo = (expr: Expr) =>
		this.type === expr.type && this.value === expr.value

	clone = () => new NumLiteral(this.value)

	extras?: {raw: string}
}

export class StrLiteral extends BaseExpr {
	readonly type = 'StrLiteral' as const

	constructor(public readonly value: string) {
		super()
	}

	protected forceEval = () => withLog(str(this.value))

	protected forceInfer = () => withLog(str(this.value))

	print = () => '"' + this.value + '"'

	isSameTo = (expr: Expr) =>
		this.type === expr.type && this.value === expr.value

	clone = () => new StrLiteral(this.value)
}

export class FnDef extends BaseExpr {
	readonly type = 'FnDef' as const

	public readonly typeVars?: TypeVarsDef
	public readonly params: ParamsDef
	public readonly returnType?: Expr
	public readonly body?: Expr

	constructor(
		typeVars: TypeVarsDef | string[] | null | undefined,
		params: ParamsDef | Record<string, Expr>,
		returnType: Expr | null,
		body: Expr | null
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

	protected forceEval = (env: Env): WithLog => {
		if (this.body) {
			// Returns function
			const {body} = this
			const {names, restName} = this.params.getNames()

			const fnObj: IFn = (...args: Arg[]) => {
				const argDict = fromPairs(zip(names, args))
				if (restName) {
					const restArgs = args.slice(names.length)
					argDict[restName] = () => vec(restArgs.map(a => a()))
				}
				const innerEnv = env.extend(argDict)

				return body.eval(innerEnv)
			}

			// fnType should be FnType as the expression is function definition
			const [fnType, fnTypeLog] = this.forceInfer(env).asTuple

			const fn = fnFrom(fnType as FnType, fnObj, this.body)

			return withLog(fn, ...fnTypeLog)
		} else {
			// Returns a function type if there's no function body
			const [{params, rest}, paramsLog] = this.params.eval(env).asTuple

			// Evaluates return type. Uses All type when no return type is defined.
			let returnType: Value = all,
				returnTypeLog: Iterable<Log> = []

			if (this.returnType) {
				;[returnType, returnTypeLog] = this.returnType.eval(env).asTuple
			}

			const fnType = new FnType(
				params,
				this.params.optionalPos,
				rest,
				returnType
			)

			return withLog(fnType, ...paramsLog, ...returnTypeLog)
		}
	}

	protected forceInfer = (env: Env): WithLog<FnType | All> => {
		if (this.body) {
			// Infer parameter types by simply evaluating 'em
			const [{params, rest}, paramsLog] = this.params.eval(env).asTuple

			// Then, infer the function body
			const arg = mapValues(params, p => () => p)
			if (rest) {
				const {name, value} = rest
				arg[name] = () => vec([], undefined, value)
			}

			const innerEnv = env.extend(arg)

			const [out, lo] = this.body.infer(innerEnv).asTuple

			const _fnType = fnType({
				params,
				optionalPos: this.params.optionalPos,
				rest,
				out,
			})

			return withLog(_fnType, ...paramsLog, ...lo)
		} else {
			// If there's no function body, the expression represents function type
			return withLog(all)
		}
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

	isSameTo = (expr: Expr) =>
		this.type === expr.type &&
		nullishEqual(this.typeVars, expr.typeVars, TypeVarsDef.isSame) &&
		ParamsDef.isSame(this.params, expr.params) &&
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

export class ParamsDef {
	readonly type = 'ParamsDef' as const
	parent!: FnDef

	public optionalPos: number

	constructor(
		public items: Record<string, Expr>,
		optionalPos?: number,
		public rest?: {name: string; expr: Expr}
	) {
		this.optionalPos = optionalPos ?? values(items).length

		// Set parent
		forOwn(items, p => (p.parent = this))
		if (rest) rest.expr.parent = this
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

	print = (options?: PrintOptions) => {
		const params = entries(this.items)
		const {optionalPos, rest} = this

		const paramStrs = params.map(printNamedNode)
		const restStrs = rest
			? ['...' + (rest.name ? rest.name + ':' : '') + rest.expr.print(options)]
			: []

		if (!this.extras) {
			const tokensCount = params.length + (rest ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)
			this.extras = {delimiters}
		}

		const {delimiters} = this.extras

		return '[' + insertDelimiters([...paramStrs, ...restStrs], delimiters) + ']'

		function printNamedNode([name, ty]: [string, Expr], index: number) {
			const optionalMark = optionalPos <= index ? '?' : ''
			return name + optionalMark + ':' + ty.print(options)
		}
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

	static isSame(a: ParamsDef, b: ParamsDef) {
		return (
			isEqualDict(a.items, b.items, isSame) &&
			a.optionalPos === b.optionalPos &&
			nullishEqual(
				a.rest,
				b.rest,
				(a, b) => a.name === b.name && isSame(a.expr, b.expr)
			)
		)
	}
}

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

	constructor(items: Expr[] = [], optionalPos?: number, rest?: Expr) {
		super()

		this.items = items
		this.optionalPos = optionalPos ?? items.length
		this.rest = rest

		// Set parent
		items.forEach(it => (it.parent = this))
		if (rest) rest.parent = this

		// Check if the passed optionalPos is valid
		if (
			this.optionalPos < 0 ||
			items.length < this.optionalPos ||
			this.optionalPos % 1 !== 0
		)
			throw new Error('Invalid optionalPos: ' + optionalPos)
	}

	protected forceEval = (env: Env): WithLog => {
		const [items, li] = Writer.map(this.items, i => i.eval(env)).asTuple
		const [rest, lr] = this.rest?.eval(env).asTuple ?? [undefined, []]
		return withLog(vec(items, this.optionalPos, rest), ...li, ...lr)
	}

	protected forceInfer = (env: Env): WithLog => {
		if (this.rest || this.items.length < this.optionalPos) {
			return withLog(all)
		}
		const [items, log] = Writer.map(this.items, it => it.infer(env)).asTuple
		return withLog(vec(items), ...log)
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

	isSameTo = (expr: Expr): boolean =>
		this.type === expr.type &&
		isEqualArray(this.items, expr.items, isSame) &&
		this.optionalPos === expr.optionalPos &&
		nullishEqual(this.rest, this.rest, isSame)

	clone = (): VecLiteral =>
		new VecLiteral(this.items.map(clone), this.optionalPos, this.rest?.clone())
}

export class DictLiteral extends BaseExpr {
	readonly type = 'DictLiteral' as const

	public readonly items: Record<string, Expr>
	public readonly optionalKeys: Set<string>
	public readonly rest?: Expr

	constructor(
		items: Record<string, Expr> = {},
		optionalKeys: Iterable<string> = [],
		rest?: Expr
	) {
		super()

		this.items = items
		this.optionalKeys = new Set(optionalKeys)
		this.rest = rest

		// Set parent
		forOwn(items, it => (it.parent = this))
		if (rest) rest.parent = this
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

	protected forceInfer = (env: Env): WithLog => {
		if (this.optionalKeys.size > 0 || this.rest) return withLog(all)

		const [items, logs] = Writer.mapValues(this.items, it =>
			it.infer(env)
		).asTuple
		return withLog(dict(items), ...logs)
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

	isSameTo = (expr: Expr): boolean =>
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

		const [fnInferred, fnLog] = this.fn.infer(env).asTuple

		if (!('fnType' in fnInferred)) return [new Unifier(), [], fnLog]

		const fnType = fnInferred.fnType

		const params = values(fnType.params)
		const args = fnType.rest ? this.args : this.args.slice(0, params.length)

		const [shadowedArgs, argLog] = Writer.map(args, a => {
			const [inferred, log] = a.infer(env).asTuple
			return withLog(shadowTypeVars(inferred), ...log)
		}).asTuple

		const paramsType = vec(params, fnType.optionalPos, fnType.rest?.value)
		const argsType = vec(shadowedArgs)

		const unifier = new Unifier([paramsType, '>=', argsType])

		return [unifier, shadowedArgs, union(fnLog, argLog)]
	}

	protected forceEval = (env: Env): WithLog => {
		if (!this.fn) return withLog(unit)

		// Evaluate the function itself at first
		const [fn, fnLog] = this.fn.eval(env).asTuple

		// Check if it's not a function
		if (!('fn' in fn)) {
			return Writer.of(fn, ...fnLog, {
				level: 'warn',
				ref: this,
				reason: 'Not a function',
			})
		}

		// Start function application
		const names = keys(fn.fnType.params)
		const params = values(fn.fnType.params)

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

		// Check types of args and cexpr them to default if necessary
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
		if (fn.fnType.rest) {
			const {name, value: pType} = fn.fnType.rest

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
		let result: Value, appLog: Set<Log | Omit<Log, 'ref'>>
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

	protected forceInfer = (env: Env): WithLog => {
		if (!this.fn) return this.forceEval(env)

		const [ty, log] = this.fn.infer(env).asTuple
		if (!('fnType' in ty)) return withLog(ty, ...log)

		/**
		 * A function type whose return type equals to All is type constructor
		 * (e.g. 'struct' function), so it should be evaluated to infer a type of
		 * the expression
		 */
		if (ty.fnType.out.isEqualTo(all)) {
			return this.eval(env)
		}

		const [unifier] = this.#unify(env)
		return withLog(unifier.substitute(ty.fnType.out, true), ...log)
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

	isSameTo = (expr: Expr) =>
		this.type === expr.type && isEqualArray(this.args, expr.args, isSame)

	clone = (): App => new App(this.fn, ...this.args.map(clone))
}

export class Scope extends BaseExpr {
	readonly type = 'Scope' as const

	constructor(public readonly items: Record<string, Expr>, public out?: Expr) {
		super()

		// Set parent
		forOwn(items, v => (v.parent = this))
		if (out) out.parent = this
	}

	protected forceInfer = (env: Env): WithLog =>
		this.out?.infer(env) ?? withLog(unit)

	protected forceEval = (env: Env) => this.out?.eval(env) ?? Writer.of(unit)

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

	isSameTo = (expr: Expr) =>
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

export class TryCatch extends BaseExpr {
	readonly type = 'TryCatch'

	constructor(public block: Expr, public handler: Expr) {
		super()

		// Set parent
		block.parent = this
		handler.parent = this
	}

	protected forceEval = (env: Env): WithLog => {
		try {
			return this.block.eval(env)
		} catch (e) {
			if (!(e instanceof GlispError)) throw e

			const log: Log = {
				level: 'error',
				reason: e.message,
				ref: e.ref,
			}

			const [handler, lh] = this.handler.eval(env).asTuple

			return withLog(handler, log, ...lh)
		}
	}

	protected forceInfer = (env: Env): WithLog => {
		const [block, lb] = this.block.infer(env).asTuple
		const [handler, lh] = this.handler.infer(env).asTuple

		return withLog(unionType(block, handler), ...lb, ...lh)
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			this.extras = {delimiters: ['', ' ', ' ', '']}
		}

		const block = this.block.print(options)
		const handler = this.handler.print(options)
		const [d0, d1, d2, d3] = this.extras.delimiters

		return `(${d0}try${d1}${block}${d2}${handler}${d3})`
	}

	extras?: {delimiters: string[]}

	isSameTo = (expr: Expr): boolean =>
		this.type === expr.type &&
		isSame(this.block, expr.block) &&
		nullishEqual(this.handler, expr.handler, isSame)

	clone = (): TryCatch => new TryCatch(this.block.clone(), this.handler.clone())
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

	protected forceInfer = (env: Env): WithLog<Value> => {
		return this.expr.infer(env)
	}

	clone = (): ValueMeta => new ValueMeta(this.fields.clone(), this.expr.clone())

	isSameTo = (expr: Expr): boolean => {
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

	static isSame(a: NodeMeta, b: NodeMeta) {
		return isSame(a.fields, b.fields)
	}
}

export function isSame(a: Expr, b: Expr): boolean {
	return a.isSameTo(b)
}

export function print(expr: Expr, options?: PrintOptions) {
	return expr.print(options)
}

export function clone(expr: Expr) {
	return expr.clone()
}

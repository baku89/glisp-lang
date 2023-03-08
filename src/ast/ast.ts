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
import * as Val from '../val'
import {Env} from './env'
import {createListDelimiters, insertDelimiters} from './PrintUtil'
import {shadowTypeVars, Unifier} from './unify'

export type Node = LeafNode | InnerNode

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
	| FnTypeDef
	| VecLiteral
	| DictLiteral
	| ValueMeta

/**
 * ASTs that can be a parent of other nodes
 */
export type ParentNode = InnerNode | ValueMeta | NodeMeta | Params

export type Arg<T extends Val.Value = Val.Value> = () => T

export interface PrintOptions {
	omitMeta?: boolean
}

/**
 * Base class for all kind of ASTs
 */
export abstract class BaseNode {
	abstract readonly type: string

	parent: ParentNode | null = null

	abstract print(options?: PrintOptions): string

	protected abstract forceEval(env: Env): WithLog
	protected abstract forceInfer(env: Env): WithLog

	abstract isSameTo(node: Node): boolean

	abstract clone(): Node

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

export class Identifier extends BaseNode {
	readonly type = 'Identifier' as const

	constructor(public readonly name: string) {
		super()
	}

	#resolve(
		ref: Node | ValueMeta | NodeMeta | Params | null,
		env: Env
	): Writer<{node: Node; mode?: 'param' | 'arg' | 'TypeVar'}, Log> {
		if (!ref) {
			// If the ast has no parent and still couldn't resolve the symbol,
			// assume there's no bound expression for it.
			const log: Log = {
				level: 'error',
				ref: this,
				reason: 'Variable not bound: ' + this.name,
			}

			return Writer.of({node: new App()}, log)
		}

		if (ref.type === 'Scope') {
			if (this.name in ref.vars) {
				return Writer.of({node: ref.vars[this.name]})
			}
		}

		if (ref.type === 'FnDef') {
			if (env.isGlobal) {
				// Situation A. While normal evaluation
				const res = ref.params.get(this.name, env)
				if (res) {
					const [node, l] = res.asTuple
					return Writer.of({node, mode: 'param'}, ...l)
				}
			} else {
				// Situation B. In a context of function appliction
				const arg = env.get(this.name)
				if (arg) {
					return Writer.of({node: new ValueContainer(arg()), mode: 'arg'})
				}
			}
			// If no corresponding arg has found for the fn, pop the env.
			env = env.pop()
		}

		// Resolve typeVars
		if (ref.type === 'FnDef' || ref.type === 'FnTypeDef') {
			const tv = ref.typeVars?.get(this.name)
			if (tv) {
				return Writer.of({
					node: new ValueContainer(tv),
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
		return this.#resolve(this.parent, env).bind(({node, mode}) => {
			const result = node.eval(env)

			return mode === 'param' ? result.fmap(v => v.defaultValue) : result
		})
	}

	protected forceInfer = (env: Env): WithLog => {
		const resolved = this.#resolve(this.parent, env)

		if (resolved.result.mode) {
			// In cases such as inferring `x` in `(=> [x:(+ 1 2)] x)`,
			// The type of parameter `(+ 1 2)` needs to be *evaluated*
			return resolved.result.node.eval(env)
		} else {
			// othersise, infer it as usual
			return resolved.bind(({node}) => node.infer(env))
		}
	}

	print = () => this.name

	isSameTo = (node: Node) => this.type === node.type && this.name === node.name

	clone = () => new Identifier(this.name)
}

/**
 * AST to store values that cannot be parsed from strings
 * e.g. DOM，Image
 */
export class ValueContainer<V extends Val.Value = Val.Value> extends BaseNode {
	readonly type = 'ValueContainer' as const

	constructor(public readonly value: V) {
		super()
	}

	protected forceEval = () => withLog(this.value)

	protected forceInfer = () => withLog(this.value.isType ? Val.all : this.value)

	print = (options?: PrintOptions) => {
		const ast = this.value.toAst()
		if (ast.type !== this.type) return ast.print(options)
		return `<value container of ${this.value.type}>`
	}

	isSameTo = (node: Node) =>
		this.type === node.type && this.value === node.value

	clone = () => new ValueContainer(this.value)
}

export class NumLiteral extends BaseNode {
	readonly type = 'NumLiteral' as const

	constructor(public readonly value: number) {
		super()
	}

	protected forceEval = () => withLog(Val.num(this.value))

	protected forceInfer = () => withLog(Val.num(this.value))

	print = () => {
		if (!this.extras) {
			this.extras = {raw: this.value.toString()}
		}

		return this.extras.raw
	}

	isSameTo = (node: Node) =>
		this.type === node.type && this.value === node.value

	clone = () => new NumLiteral(this.value)

	extras?: {raw: string}
}

export class StrLiteral extends BaseNode {
	readonly type = 'StrLiteral' as const

	constructor(public readonly value: string) {
		super()
	}

	protected forceEval = () => withLog(Val.str(this.value))

	protected forceInfer = () => withLog(Val.str(this.value))

	print = () => '"' + this.value + '"'

	isSameTo = (node: Node) =>
		this.type === node.type && this.value === node.value

	clone = () => new StrLiteral(this.value)
}

export class FnDef extends BaseNode {
	readonly type = 'FnDef' as const

	public readonly typeVars?: TypeVarsDef
	public readonly params: Params

	constructor(
		typeVars: TypeVarsDef | string[] | null | undefined,
		params: Params | Record<string, Node>,
		public readonly body: Node
	) {
		super()

		if (typeVars) {
			if (Array.isArray(typeVars)) {
				this.typeVars = new TypeVarsDef(typeVars)
			} else {
				this.typeVars = typeVars
			}
		}

		this.params = params instanceof Params ? params : new Params(params)

		// Set parent
		this.params.parent = this
		this.body.parent = this
	}

	protected forceEval = (env: Env): WithLog => {
		const {names, restName} = this.params.getNames()

		const fn: Val.IFn = (...args: Arg[]) => {
			const arg = fromPairs(zip(names, args))
			if (restName) {
				const restArgs = args.slice(names.length)
				arg[restName] = () => Val.vec(restArgs.map(a => a()))
			}
			const innerEnv = env.extend(arg)
			return this.body.eval(innerEnv)
		}

		const [ty, lty] = this.forceInfer(env).asTuple

		const fnVal = Val.fnFrom(ty, fn, this.body)

		return withLog(fnVal, ...lty)
	}

	protected forceInfer = (env: Env): WithLog<Val.FnType> => {
		// Infer parameter types by simply evaluating 'em
		const [{params, rest}, lp] = this.params.eval(env).asTuple

		// Then, infer the function body
		const arg = mapValues(params, p => () => p)
		if (rest) {
			const {name, value} = rest
			arg[name as any] = () => Val.vec([], undefined, value)
		}

		const innerEnv = env.extend(arg)

		const [out, lo] = this.body.infer(innerEnv).asTuple

		const fnType = Val.fnType({
			params,
			optionalPos: this.params.optionalPos,
			rest,
			out,
		})

		return withLog(fnType, ...lp, ...lo)
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			const tokensCount = this.typeVars ? 4 : 3
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const typeVars = this.typeVars ? [this.typeVars.print()] : []
		const params = this.params.print(options)
		const body = this.body.print(options)

		const elements = ['=>', ...typeVars, params, body]

		return '(' + insertDelimiters(elements, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (node: Node) =>
		this.type === node.type &&
		nullishEqual(this.typeVars, node.typeVars, TypeVarsDef.isSame) &&
		Params.isSame(this.params, node.params) &&
		isSame(this.body, node.body)

	clone = (): FnDef =>
		new FnDef(this.typeVars?.clone(), this.params.clone(), this.body.clone())
}

export class FnTypeDef extends BaseNode {
	readonly type = 'FnTypeDef' as const

	public readonly typeVars?: TypeVarsDef
	public readonly params: Params

	constructor(
		typeVars: TypeVarsDef | string[] | undefined | null,
		params: Params | Record<string, Node>,
		public out: Node
	) {
		super()

		if (typeVars) {
			if (Array.isArray(typeVars)) {
				this.typeVars = new TypeVarsDef(typeVars)
			} else {
				this.typeVars = typeVars
			}
		}

		this.params = params instanceof Params ? params : new Params(params)

		// Set parent
		this.params.parent = this
		this.out.parent = this
	}

	protected forceEval = (env: Env): WithLog => {
		const [{params, rest}, lp] = this.params.eval(env).asTuple

		const [out, lo] = this.out.eval(env).asTuple

		const fnType = Val.fnType({
			params,
			optionalPos: this.params.optionalPos,
			rest,
			out,
		})

		return withLog(fnType, ...lp, ...lo)
	}

	protected forceInfer = () => withLog(Val.all)

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			const tokensCount = this.typeVars ? 4 : 3
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const typeVars = this.typeVars ? [this.typeVars.print()] : []
		const params = this.params.print(options)
		const out = this.out.print(options)

		const elements = ['->', ...typeVars, params, out]

		return '(' + insertDelimiters(elements, this.extras.delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (node: Node): boolean =>
		this.type === node.type &&
		nullishEqual(this.typeVars, node.typeVars, TypeVarsDef.isSame) &&
		Params.isSame(this.params, node.params) &&
		isSame(this.out, node.out)

	clone = (): FnTypeDef =>
		new FnTypeDef(this.typeVars?.clone(), this.params.clone(), this.out.clone())
}

export class Params {
	readonly type = 'Params' as const
	parent!: FnDef | FnTypeDef

	public optionalPos: number

	constructor(
		public items: Record<string, Node>,
		optionalPos?: number,
		public rest?: {name: string; node: Node}
	) {
		this.optionalPos = optionalPos ?? values(items).length

		// Set parent
		forOwn(items, p => (p.parent = this))
		if (rest) rest.node.parent = this
	}

	eval = (env: Env) => {
		// Infer parameter types by simply evaluating 'em
		const [params, lp] = Writer.mapValues(this.items, p => p.eval(env)).asTuple

		let rest: Val.FnType['rest'], lr: Set<Log>
		if (this.rest) {
			const [value, _lr] = this.rest.node.eval(env).asTuple
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
			? ['...' + (rest.name ? rest.name + ':' : '') + rest.node.print(options)]
			: []

		if (!this.extras) {
			const tokensCount = params.length + (rest ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)
			this.extras = {delimiters}
		}

		const {delimiters} = this.extras

		return '[' + insertDelimiters([...paramStrs, ...restStrs], delimiters) + ']'

		function printNamedNode([name, ty]: [string, Node], index: number) {
			const optionalMark = optionalPos <= index ? '?' : ''
			return name + optionalMark + ':' + ty.print(options)
		}
	}

	extras?: {delimiters: string[]}

	clone = () => {
		return new Params(
			mapValues(this.items, clone),
			this.optionalPos,
			this.rest
				? {name: this.rest.name, node: this.rest.node.clone()}
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
			return Writer.of<Node, Log>(this.items[name])
		}
		if (this.rest && this.rest.name === name) {
			const [rest, lr] = this.rest.node.eval(env).asTuple
			const node = new ValueContainer(Val.vec([], undefined, rest))
			return Writer.of(node, ...lr)
		}
	}

	static isSame(a: Params, b: Params) {
		return (
			isEqualDict(a.items, b.items, isSame) &&
			a.optionalPos === b.optionalPos &&
			nullishEqual(
				a.rest,
				b.rest,
				(a, b) => a.name === b.name && isSame(a.node, b.node)
			)
		)
	}
}

export class TypeVarsDef {
	readonly typeVars: Record<string, Val.TypeVar>

	constructor(readonly names: string[]) {
		this.typeVars = fromPairs(names.map(name => [name, Val.typeVar(name)]))
	}

	get = (name: string): Val.TypeVar | undefined => this.typeVars[name]

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

export class VecLiteral extends BaseNode {
	readonly type = 'VecLiteral' as const

	public readonly items: Node[]
	public readonly optionalPos: number
	public readonly rest?: Node

	constructor(items: Node[] = [], optionalPos?: number, rest?: Node) {
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
		return withLog(Val.vec(items, this.optionalPos, rest), ...li, ...lr)
	}

	protected forceInfer = (env: Env): WithLog => {
		if (this.rest || this.items.length < this.optionalPos) {
			return withLog(Val.all)
		}
		const [items, log] = Writer.map(this.items, it => it.infer(env)).asTuple
		return withLog(Val.vec(items), ...log)
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

	isSameTo = (node: Node): boolean =>
		this.type === node.type &&
		isEqualArray(this.items, node.items, isSame) &&
		this.optionalPos === node.optionalPos &&
		nullishEqual(this.rest, this.rest, isSame)

	clone = (): VecLiteral =>
		new VecLiteral(this.items.map(clone), this.optionalPos, this.rest?.clone())
}

export class DictLiteral extends BaseNode {
	readonly type = 'DictLiteral' as const

	public readonly items: Record<string, Node>
	public readonly optionalKeys: Set<string>
	public readonly rest?: Node

	constructor(
		items: Record<string, Node> = {},
		optionalKeys: Iterable<string> = [],
		rest?: Node
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
		return withLog(Val.dict(items, this.optionalKeys, rest), ...li, ...lr)
	}

	eval!: (env?: Env) => WithLog<Val.Dict>

	protected forceInfer = (env: Env): WithLog => {
		if (this.optionalKeys.size > 0 || this.rest) return withLog(Val.all)

		const [items, logs] = Writer.mapValues(this.items, it =>
			it.infer(env)
		).asTuple
		return withLog(Val.dict(items), ...logs)
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

	isSameTo = (node: Node): boolean =>
		this.type === node.type &&
		isEqualDict(this.items, node.items, isSame) &&
		isEqualSet(this.optionalKeys, node.optionalKeys) &&
		nullishEqual(this.rest, node.rest, isSame)

	clone = (): DictLiteral =>
		new DictLiteral(
			mapValues(this.items, clone),
			this.optionalKeys,
			this.rest?.clone()
		)
}

export class App extends BaseNode {
	readonly type = 'App' as const

	readonly fn?: Node
	readonly args: Node[]

	constructor(fn?: Node, ...args: Node[]) {
		super()
		this.fn = fn
		this.args = args

		// Set parent
		if (fn) fn.parent = this
		args.forEach(a => (a.parent = this))
	}

	#unify(env: Env): [Unifier, Val.Value[], Set<Log>] {
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

		const paramsType = Val.vec(params, fnType.optionalPos, fnType.rest?.value)
		const argsType = Val.vec(shadowedArgs)

		const unifier = new Unifier([paramsType, '>=', argsType])

		return [unifier, shadowedArgs, union(fnLog, argLog)]
	}

	protected forceEval = (env: Env): WithLog => {
		if (!this.fn) return withLog(Val.unit)

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

		// Check types of args and cast them to default if necessary
		const args = unifiedParams.map((pType, i) => {
			const aType = unifiedArgs[i] ?? Val.unit
			const name = names[i]

			if (Val.isSubtype(aType, pType)) {
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

				if (Val.isSubtype(aType, pType)) {
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
		let result: Val.Value, appLog: Set<Log | Omit<Log, 'ref'>>
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
		if (ty.fnType.out.isEqualTo(Val.all)) {
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

	isSameTo = (node: Node) =>
		this.type === node.type && isEqualArray(this.args, node.args, isSame)

	clone = (): App => new App(this.fn, ...this.args.map(clone))
}

export class Scope extends BaseNode {
	readonly type = 'Scope' as const

	constructor(public readonly vars: Record<string, Node>, public out?: Node) {
		super()

		// Set parent
		forOwn(vars, v => (v.parent = this))
		if (out) out.parent = this
	}

	protected forceInfer = (env: Env): WithLog =>
		this.out?.infer(env) ?? withLog(Val.unit)

	protected forceEval = (env: Env) => this.out?.eval(env) ?? Writer.of(Val.unit)

	print = (options?: PrintOptions): string => {
		const varEntries = entries(this.vars)

		if (!this.extras) {
			const tokensCount = 1 + varEntries.length * 2 + (this.out ? 1 : 0)
			const delimiters = createListDelimiters(tokensCount)

			this.extras = {delimiters}
		}

		const vars = varEntries.map(([k, v]) => [k + ':', v.print(options)]).flat()
		const out = this.out ? [this.out.print(options)] : []

		const {delimiters} = this.extras

		return '(' + insertDelimiters(['let', ...vars, ...out], delimiters) + ')'
	}

	extras?: {delimiters: string[]}

	isSameTo = (node: Node) =>
		this.type === node.type &&
		nullishEqual(this.out, node.out, isSame) &&
		isEqualDict(this.vars, node.vars, isSame)

	clone = (): Scope => new Scope(mapValues(this.vars, clone), this.out?.clone())

	extend(vars: Record<string, Node>, out?: Node): Scope {
		const scope = new Scope(vars, out)
		scope.parent = this
		return scope
	}

	def(name: string, node: Node) {
		if (name in this.vars)
			throw new Error(`Variable '${name}' is already defined`)

		node.parent = this
		this.vars[name] = node

		return this
	}

	defs(vars: Record<string, Node>) {
		for (const [name, exp] of entries(vars)) {
			this.def(name, exp)
		}
	}
}

export class TryCatch extends BaseNode {
	readonly type = 'TryCatch'

	constructor(public block: Node, public handler: Node) {
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

		return withLog(Val.unionType(block, handler), ...lb, ...lh)
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

	isSameTo = (node: Node): boolean =>
		this.type === node.type &&
		isSame(this.block, node.block) &&
		nullishEqual(this.handler, node.handler, isSame)

	clone = (): TryCatch => new TryCatch(this.block.clone(), this.handler.clone())
}

export class ValueMeta extends BaseNode {
	readonly type = 'ValueMeta' as const

	extras?: {delimiters: [string, string]}

	constructor(public readonly fields: Node, public readonly node: Node) {
		super()

		// Set parent
		fields.parent = this
		node.parent = this
	}

	protected forceEval = (env: Env): WithLog<Val.Value> => {
		const [_fields, fieldLog] = this.fields.eval(env).asTuple
		const [_node, nodeLog] = this.node.eval(env).asTuple

		let fields = _fields,
			node = _node

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
			return withLog(node, ...nodeLog, ...metaLog)
		}

		// When the default key exists
		const defaultValue = fields.items.default
		if (defaultValue) {
			fields = fields.clone()
			delete fields.items.default

			node = node.withMeta(fields)

			// Check if the default value is valid
			if (node.isTypeFor(defaultValue)) {
				node = node.withDefault(defaultValue)
			} else {
				metaLog.add({
					level: 'warn',
					ref: this,
					reason:
						`Cannot use ${defaultValue.print()} ` +
						`as a default value of ${node.print()}`,
				})
			}
		}

		return withLog(node, ...fieldLog, ...nodeLog, ...metaLog)
	}

	protected forceInfer = (env: Env): WithLog<Val.Value> => {
		return this.node.infer(env)
	}

	clone = (): ValueMeta => new ValueMeta(this.fields.clone(), this.node.clone())

	isSameTo = (node: Node): boolean => {
		return (
			this.type === node.type &&
			this.fields.isSameTo(node.fields) &&
			this.node.isSameTo(node.node)
		)
	}

	print = (options?: PrintOptions): string => {
		if (!this.extras) {
			this.extras = {delimiters: ['', '']}
		}

		const [d0, d1] = this.extras.delimiters
		const fields = this.fields.print(options)
		const node = this.node.print(options)

		return `^${d0}${fields}${d1}${node}`
	}
}

export class NodeMeta {
	readonly type = 'NodeMeta' as const

	public attachedTo!: Node

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

export function isSame(a: Node, b: Node): boolean {
	return a.isSameTo(b)
}

export function print(node: Node, options?: PrintOptions) {
	return node.print(options)
}

export function clone(node: Node) {
	return node.clone()
}

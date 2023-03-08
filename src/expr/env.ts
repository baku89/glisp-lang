import {WithLog} from '../log'
import type {Arg, BaseNode} from './expr'

type ArgDict = Record<string, Arg>

export class Env {
	#outer!: Env | undefined
	#arg: ArgDict
	#evalCache: WeakMap<BaseNode, WithLog> = new WeakMap()
	#inferCache: WeakMap<BaseNode, WithLog> = new WeakMap()
	readonly isGlobal!: boolean

	private constructor(original: Env | undefined, arg: ArgDict) {
		this.#outer = original
		this.#arg = arg
		this.isGlobal = !original
	}

	push(arg: ArgDict) {
		return new Env(this, arg)
	}

	pop() {
		return this.#outer ?? this
	}

	get(name: string): Arg | undefined {
		return this.#arg[name]
	}

	extend(arg: ArgDict) {
		return new Env(this, arg)
	}

	memoizeEval(expr: BaseNode, evaluate: (env: Env) => WithLog): WithLog {
		let cache = this.#evalCache.get(expr)
		if (!cache) {
			this.#evalCache.set(expr, (cache = evaluate(this)))
		}
		return cache
	}

	memoizeInfer(expr: BaseNode, infer: (env: Env) => WithLog): WithLog {
		let cache = this.#inferCache.get(expr)
		if (!cache) {
			this.#inferCache.set(expr, (cache = infer(this)))
		}
		return cache
	}

	static global = new Env(undefined, {})
}

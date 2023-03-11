import {WithLog} from '../log'
import type {Arg, BaseExpr} from './expr'

type ArgDict = Record<string, Arg>

export class Env {
	#outer!: Env | undefined
	#arg: ArgDict
	#evalCache: WeakMap<BaseExpr, WithLog> = new WeakMap()
	#inferCache: WeakMap<BaseExpr, WithLog> = new WeakMap()
	readonly isGlobal!: boolean

	private constructor(original: Env | undefined, arg: ArgDict) {
		this.#outer = original
		this.#arg = arg
		this.isGlobal = !original
	}

	extend(arg: ArgDict) {
		return new Env(this, arg)
	}

	pop() {
		return this.#outer ?? this
	}

	get(name: string): Arg | undefined {
		return this.#arg[name]
	}

	memoizeEval(expr: BaseExpr, evaluate: (env: Env) => WithLog): WithLog {
		let cache = this.#evalCache.get(expr)
		if (!cache) {
			this.#evalCache.set(expr, (cache = evaluate(this)))
		}
		return cache
	}

	memoizeInfer(expr: BaseExpr, infer: (env: Env) => WithLog): WithLog {
		let cache = this.#inferCache.get(expr)
		if (!cache) {
			this.#inferCache.set(expr, (cache = infer(this)))
		}
		return cache
	}

	static global = new Env(undefined, {})
}

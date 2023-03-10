import {WithLog} from '../log'
import {Value} from '../value'
import type {Arg, BaseExpr} from '.'

type ArgDict = Record<string, Arg>

/**
 * 関数のコールスタックのようなもの。引数名-引数のセットを保持する.
 * 通常の評価器における環境とことなり、そのスコープで宣言された変数と値のペアではない.
 * EnvはSingly Liked Listのような構造をしており、#outerはより外側の関数呼び出し時に
 * スタックされた環境への参照を保持する。#outerが無い
 */
export class Env {
	#outer!: Env | undefined
	#arg: ArgDict
	#evalCache: WeakMap<BaseExpr, WithLog> = new WeakMap()
	#inferCache: WeakMap<BaseExpr, Value> = new WeakMap()

	private constructor(original: Env | undefined, arg: ArgDict) {
		this.#outer = original
		this.#arg = arg
	}

	get isGlobal() {
		return !this.#outer
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

	memoizeInfer(expr: BaseExpr, infer: (env: Env) => Value): Value {
		let cache = this.#inferCache.get(expr)
		if (!cache) {
			this.#inferCache.set(expr, (cache = infer(this)))
		}
		return cache
	}

	static global = new Env(undefined, {})
}

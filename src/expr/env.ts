import {Log, WithLog} from '../log'
import {union} from '../util/SetOperation'
import {Value} from '../value'
import type {BaseExpr, Expr} from '.'

/**
 * 関数のコールスタックのようなもの。引数名-引数のセットを保持する.
 * 通常の評価器における環境とことなり、そのスコープで宣言された変数と値のペアではない.
 * EnvはSingly Liked Listのような構造をしており、#outerはより外側の関数呼び出し時に
 * スタックされた環境への参照を保持する。#outerが無いEnvはグローバルスコープ
 */
export class Env {
	#outer!: Env | undefined
	#arg: Record<string, Value>
	#evalCache: WeakMap<BaseExpr, WithLog> = new WeakMap()
	#inferCache: WeakMap<BaseExpr, Value> = new WeakMap()

	private constructor(original: Env | undefined, arg: Record<string, Value>) {
		this.#outer = original
		this.#arg = arg
	}

	get isGlobal() {
		return !this.#outer
	}

	extend(arg: Record<string, Value>) {
		return new Env(this, arg)
	}

	pop() {
		return this.#outer ?? this
	}

	getArg(name: string): Value | undefined {
		return this.#arg[name]
	}

	memoizeEval(expr: BaseExpr): WithLog {
		let cache = this.#evalCache.get(expr)

		if (!cache) {
			let logs: Set<Log>[] = []

			const evaluate = (e: Expr): Value => {
				const [value, log] = e.eval(this).asTuple
				logs.push(log)
				return value
			}

			cache = expr.forceEval(this, evaluate)
			cache.log = union(...logs, cache.log)

			this.#evalCache.set(expr, cache)
		}
		return cache
	}

	memoizeInfer(expr: BaseExpr): Value {
		let cache = this.#inferCache.get(expr)
		if (!cache) {
			cache = expr.forceInfer(this)
			this.#inferCache.set(expr, cache)
		}
		return cache
	}

	static global = new Env(undefined, {})
}

import {WithLog} from '../log'
import {Value} from '../value'
import type {BaseExpr} from '.'

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

	getEvalCache(expr: BaseExpr): WithLog | null {
		return this.#evalCache.get(expr) ?? null
	}

	setEvalCache(expr: BaseExpr, result: WithLog) {
		return this.#evalCache.set(expr, result)
	}

	getInferCache(expr: BaseExpr): Value | null {
		return this.#inferCache.get(expr) ?? null
	}

	setInferCache(expr: BaseExpr, type: Value) {
		return this.#inferCache.set(expr, type)
	}

	static global = new Env(undefined, {})
}

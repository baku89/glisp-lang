import {Value} from '../value'
import {BaseExpr} from '.'

/**
 * 関数のコールスタックのようなもの。引数名-引数のセットを保持する.
 * 通常の評価器における環境とことなり、そのスコープで宣言された変数と値のペアではない.
 * EnvはSingly Liked Listのような構造をしており、#outerはより外側の関数呼び出し時に
 * スタックされた環境への参照を保持する。#outerが無いEnvはグローバルスコープ
 */
export class Env {
	#outer!: Env | null
	#arg: Record<string, Value>

	evalCache = new WeakMap<BaseExpr, Value>()
	inferCache = new WeakMap<BaseExpr, Value>()

	private constructor(
		outer: Env | null = null,
		arg: Record<string, Value> = {}
	) {
		this.#outer = outer
		this.#arg = arg
	}

	get isGlobal() {
		return !this.#outer
	}

	push(arg: Record<string, Value> = {}) {
		return new Env(this, arg)
	}

	pop() {
		return this.#outer ?? this
	}

	getArg(name: string): Value | undefined {
		return this.#arg[name]
	}

	static global = new Env()
}

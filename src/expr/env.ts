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
	#evalCache: WeakMap<BaseExpr, WithLog>
	#inferCache: WeakMap<BaseExpr, WithLog>

	// Store the reference to Expr that have been traversed so far
	// in the series of evaluation/inference processes.
	// This is for detecting circular references.
	#evalDeps: Set<BaseExpr>
	#inferDeps: Set<BaseExpr>

	private constructor(
		outer: Env | undefined,
		arg: Record<string, Value>,
		evalCache: WeakMap<BaseExpr, WithLog>,
		inferCache: WeakMap<BaseExpr, WithLog>,
		evalDeps: Set<BaseExpr>,
		inferDeps: Set<BaseExpr>
	) {
		this.#outer = outer
		this.#arg = arg
		this.#evalCache = evalCache
		this.#inferCache = inferCache
		this.#evalDeps = evalDeps
		this.#inferDeps = inferDeps
	}

	get isGlobal() {
		return !this.#outer
	}

	push(arg: Record<string, Value>) {
		return new Env(
			this,
			arg,
			new WeakMap(),
			new WeakMap(),
			this.#evalDeps,
			this.#inferDeps
		)
	}

	pop() {
		return this.#outer ?? this
	}

	withEvalDep(expr: BaseExpr): Env {
		const evalDeps = new Set([expr, ...this.#evalDeps])
		return new Env(
			this.#outer,
			this.#arg,
			this.#evalCache,
			this.#inferCache,
			evalDeps,
			this.#inferDeps
		)
	}

	hasEvalDep(expr: BaseExpr): boolean {
		return this.#evalDeps.has(expr)
	}

	withInferDep(expr: BaseExpr): Env {
		const inferDeps = new Set([expr, ...this.#inferDeps])
		return new Env(
			this.#outer,
			this.#arg,
			this.#evalCache,
			this.#inferCache,
			this.#evalDeps,
			inferDeps
		)
	}

	hasInferDep(expr: BaseExpr): boolean {
		return this.#inferDeps.has(expr)
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

	getInferCache(expr: BaseExpr): WithLog | null {
		return this.#inferCache.get(expr) ?? null
	}

	setInferCache(expr: BaseExpr, type: WithLog) {
		return this.#inferCache.set(expr, type)
	}

	static global = new Env(
		undefined,
		{},
		new WeakMap(),
		new WeakMap(),
		new Set(),
		new Set()
	)
}

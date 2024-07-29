import {CompoundAst} from './ast'

/**
 * Glispにおける環境（計算機の状態を保持するオブジェクト）は、
 * そのASTの直近の親から始まり、最終的にはグローバルな環境に至るまでの連結リスト。
 */
export class Env {
	constructor(readonly ast: CompoundAst, readonly parent?: Env) {}

	/**
	 * この環境に子ASTを追加した新しい環境を返す。
	 * 0や関数値といった、値（Value）を親に持つ式は存在しないため、Expr型のみを受け取る。
	 * 環境はmemoizedされる
	 */
	pushed(ast: CompoundAst): Env {
		if (!this.#childEnvs.has(ast)) {
			this.#childEnvs.set(ast, new Env(ast, this))
		}
		return this.#childEnvs.get(ast)!
	}

	#childEnvs = new WeakMap<CompoundAst, Env>()
}

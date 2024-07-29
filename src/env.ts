import {CompoundAst} from './ast'

/**
 * Glispにおける環境（計算機の状態を保持するオブジェクト）は、
 * そのASTの直近の親から始まり、最終的にはグローバルな環境に至るまでの連結リスト。
 */
export class Env {
	private constructor(readonly ast: CompoundAst, readonly parent?: Env) {}

	/**
	 * この環境に子ASTを追加した新しい環境を返す。
	 * 0や関数値といった、値（Value）を親に持つ式は存在しないため、Expr型のみを受け取る。
	 * 環境はmemoizedされる
	 */
	pushed(ast: CompoundAst): Env {
		let innerEnv = this.#childEnvs.get(ast)
		if (!innerEnv) {
			innerEnv = new Env(ast, this)
			this.#childEnvs.set(ast, innerEnv)
		}
		return innerEnv
	}

	#childEnvs = new WeakMap<CompoundAst, Env>()
}

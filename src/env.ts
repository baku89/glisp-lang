import {CompoundAst} from './ast'
import {memoize} from './util/memoize'

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
	@memoize()
	pushed(ast: CompoundAst): Env {
		return new Env(ast, this)
	}
}

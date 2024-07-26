import {Ast} from './ast'

/**
 * Glispにおける環境（計算機の状態を保持するオブジェクト）は、
 * そのASTの直近の親から始まり、最終的にはグローバルな環境に至るまでの連結リスト。
 */
export class Env {
	constructor(readonly ast: Ast, readonly parent?: Env) {}

	/**
	 * この環境に子ASTを追加した新しい環境を返す。
	 */
	push(ast: Ast): Env {
		return new Env(ast, this)
	}
}

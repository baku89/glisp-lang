import {type Ast} from './ast'
import {type Env} from './env'

/**
 * ある環境におけるASTを表す
 */
export interface CallStack {
	ast: Ast
	env: Env
}

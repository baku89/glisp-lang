import {Ast} from './ast'
import {CallStack} from './CallStack'

/**
 * ログを格納する
 */
export interface Log {
	level: 'error' | 'warn' | 'info'
	/**
	 * ログの内容。['Symbol ', s`s`, ' is not defined']のように、式を保持したままログを出力する
	 */
	reason: (string | Ast)[]
	callstack?: CallStack
}

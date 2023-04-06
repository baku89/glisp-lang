import type {Expr} from './expr'

/**
 * ログを格納する
 */
export interface Log {
	level: 'error' | 'warn' | 'info'
	reason: string
	ref?: Expr
}

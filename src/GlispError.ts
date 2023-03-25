import type {Expr} from './expr'

/**
 * A subclass of built-in Error containing a reference to Glisp's AST which
 * throws a run-time error
 */
export class GlispError extends Error {
	constructor(public readonly ref: Expr, message?: string | undefined) {
		super(message)
	}
}

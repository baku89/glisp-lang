import type {Expr} from './expr'

export class GlispError extends Error {
	constructor(public readonly ref: Expr, message?: string | undefined) {
		super(message)
	}
}

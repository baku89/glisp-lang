import {Log} from '../Log'
import {BaseExpr} from '.'

class CallStack {
	#stack: BaseExpr[] = []
	#sets = new Map<BaseExpr, Set<Log>>()

	push(expr: BaseExpr) {
		this.#stack.push(expr)
		this.#sets.set(expr, new Set())
	}

	has(expr: BaseExpr) {
		return this.#sets.has(expr)
	}

	pop() {
		const callee = this.#stack.pop()
		if (callee) {
			const log = this.#sets.get(callee) ?? new Set()
			this.#sets.delete(callee)
			return log
		}
		throw new Error('Invalid CallStack')
	}

	get callee() {
		return this.#stack.at(-1) ?? null
	}

	pushLog(log: Set<Log> = new Set()) {
		for (const s of this.#sets.values()) {
			for (const l of log) {
				s.add(l)
			}
		}
	}
}

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs = new CallStack()
export const inferringExprs = new CallStack()

export const changedExprs = new Set<BaseExpr>()
export const editedExprs = new Set<BaseExpr>()

export function notifyChangedExprs() {
	try {
		changedExprs.forEach(e => e.emit('change'))
		editedExprs.forEach(e => e.emit('edit'))
	} finally {
		changedExprs.clear()
		editedExprs.clear()
	}
}

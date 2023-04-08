import {BaseExpr} from '.'

class CallStack {
	#stack: BaseExpr[] = []
	#sets = new WeakSet<BaseExpr>()

	push(expr: BaseExpr) {
		this.#stack.push(expr)
		this.#sets.add(expr)
	}

	has(expr: BaseExpr) {
		return this.#sets.has(expr)
	}

	pop() {
		const callee = this.#stack.pop()
		if (callee) this.#sets.delete(callee)
	}

	get callee() {
		return this.#stack.at(-1) ?? null
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

import type {BaseExpr, Expr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs = new Set<BaseExpr>()
export const inferringExprs = new Set<BaseExpr>()

export const changedExprs = new Set<BaseExpr>()

export function notifyChangedExprs() {
	try {
		changedExprs.forEach(e => e.emit('change'))
	} finally {
		changedExprs.clear()
	}
}

/**
 * 式の中で参照
 */
export function clearCaches(expr: Expr) {
	if (!expr) return

	expr.evalDep.forEach(e => {
		changedExprs.add(e)
		e.clearEvalCache()
	})
	expr.inferDep.forEach(e => e.clearInferCache())
}

import type {BaseExpr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs: BaseExpr[] = []
export const inferringExprs: BaseExpr[] = []

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
export function clearEvalCaches(expr: BaseExpr) {
	expr.evalDep.forEach(e => {
		changedExprs.add(e)
		e.clearEvalCache()
		clearEvalCaches(e)
	})
}

export function clearInferCaches(expr: BaseExpr) {
	expr.inferDep.forEach(e => {
		e.clearInferCache()
		clearInferCaches(e)
	})
}

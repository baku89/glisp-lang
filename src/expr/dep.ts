import type {BaseExpr, Expr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs = new Set<BaseExpr>()
export const inferringExprs = new Set<BaseExpr>()

/**
 * 式の中で参照
 */
export function clearCaches(expr: Expr, childExpr: Expr | null) {
	if (!childExpr) return

	childExpr.evalDep.forEach(e => e.clearEvalCache())
	childExpr.inferDep.forEach(e => e.clearInferCache())

	// NOTE: このタイミングで良いのかな?
	childExpr.evalDep.forEach(e => e.emit('change'))
}

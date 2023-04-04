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

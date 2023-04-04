import {BaseExpr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs: BaseExpr[] = []
export const inferringExprs: BaseExpr[] = []

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

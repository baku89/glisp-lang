import type {BaseExpr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs = new Set<BaseExpr>()
export const inferringExprs = new Set<BaseExpr>()

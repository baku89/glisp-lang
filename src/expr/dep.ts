import type {BaseExpr} from '.'

// Stores currently evaluating/inferring exprs to detect circular reference
export const evaluatingExprs = new WeakSet<BaseExpr>()
export const inferringExprs = new WeakSet<BaseExpr>()

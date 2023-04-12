import {AnyExpr, Expr, InnerExpr, Symbol} from '.'
import {CurrentPath, Path, UpPath} from './path'

function getInnerAncestors(expr: Expr) {
	const ancestors: InnerExpr[] = []

	let e: InnerExpr | null = expr.innerParent

	while (e) {
		ancestors.push(e)
		e = e.innerParent
	}

	return ancestors
}

/**
 * 式 from の位置から式 to を参照するためのシンボルを算出する
 * @param from 参照元の式
 * @param to 参照先の式
 */
export function computeSymbol(from: Expr, to: Expr): Symbol | null {
	// 共通の祖先があるかをチェック
	const fromAncestors = getInnerAncestors(from)
	const toAncestors = getInnerAncestors(to)

	let commonParent: Expr | null = null
	for (const [fi, fa] of fromAncestors.entries()) {
		for (const ta of toAncestors) {
			if (fa === ta) {
				// 共通祖先より先を削除
				fromAncestors.splice(fi + 1, fromAncestors.length)
				commonParent = fa
				break
			}
		}
	}

	if (!commonParent) {
		throw new Error('Not common parent')
	}

	const upwardPaths: Path[] = []

	for (const ancestor of fromAncestors) {
		if (ancestor.type === 'Scope') {
			// NOTE: 色々マズい
			upwardPaths.splice(0, upwardPaths.length)
		} else {
			if (upwardPaths.length === 0 && from.type === 'Symbol') {
				upwardPaths.push(CurrentPath)
			} else {
				upwardPaths.push(UpPath)
			}
		}
	}

	const downwardPaths: Path[] = []

	let parent = to.parent
	let curt: AnyExpr = to
	while (parent && curt !== commonParent) {
		if (
			parent.type !== 'ParamsDef' &&
			parent.type !== 'TypeVarDef' &&
			parent.type !== 'ValueMeta' &&
			curt.type !== 'ParamsDef' &&
			curt.type !== 'TypeVarDef'
		) {
			const key = parent.getKey(curt)
			if (key === null) return null
			downwardPaths.unshift(key)
		}
		;[parent, curt] = [parent.parent, parent]
	}

	return new Symbol([...upwardPaths, ...downwardPaths])
}

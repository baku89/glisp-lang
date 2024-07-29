import {Ast, Current, isCompoundAst, Key, Parent, Scope} from './ast'
import {Env} from './env'
import {GlobalEnv} from './eval'
import {findAstByKey} from './findAstByKey'

/**
 * ASTを辿り、シンボル解決をする
 * @param path キーのリスト
 * @param ast 起点となるAST
 * @param env 環境
 * @returns
 */
export function resolvePath(
	path: readonly Key[],
	ast: Ast,
	env = GlobalEnv
): {ast: Ast; env?: Env} {
	// path が空の場合
	if (path.length === 0) {
		return {ast, env}
	}

	const [first, ...rest] = path

	// . から始まる場合
	if (first === Current) {
		if (rest.length === 0) {
			return {ast, env}
		}

		const [second, ...rest1] = rest

		if (second === Current || second === Parent) {
			// ././x -> ./x
			// ./../x -> ../x
			// に縮約する
			return resolvePath([second, ...rest1], ast, env)
		} else {
			// ./x/y だった場合、現在のastから x に該当する「子」のASTを探し、
			// そこを基準として ./y を解決する
			if (isCompoundAst(ast)) {
				const child = findAstByKey(ast, second)
				const innerEnv = env.pushed(ast)
				return resolvePath([Current, ...rest1], child, innerEnv)
			} else {
				throw new Error(`Not has ${second} key`)
			}
		}
	} else if (first === Parent) {
		// .. から始まる場合
		if (rest.length === 0) {
			// 単に .. の場合、親のASTを返す
			return {ast: env.ast, env: env.parent}
		}

		const [second, ...rest1] = rest

		if (second === Current || second === Parent) {
			// .././x または ../../x の場合、
			// 現在のASTの親を探し、そこを基準として ./x または ../x を解決
			const parent = env.ast
			const parentEnv = env.parent ?? env
			return resolvePath([second, ...rest1], parent, parentEnv)
		} else {
			// ../x/y だった場合、親のastから x に該当する「おば」のASTを探し、
			// そこを基準として ./y を解決
			const aunt = findAstByKey(env.ast, second)
			const parentEnv = env.parent ?? env
			return resolvePath([Current, ...rest1], aunt, parentEnv)
		}
	} else {
		// それ以外の場合、Scopeにぶち当たるまで親をたどる
		let currentEnv: Env | undefined = env
		while (currentEnv) {
			if (currentEnv.ast instanceof Scope && first in currentEnv.ast.vars) {
				const found = currentEnv.ast.vars[first]
				return resolvePath([Current, ...rest], found, currentEnv)
			}
			currentEnv = currentEnv.parent
		}
		throw new Error(`Not found: ${first}`)
	}
}

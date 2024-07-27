import {Ast, Current, Key, Parent, Scope} from './ast'
import {Env} from './env'
import {findAstByKey} from './findAstByKey'

export function resolvePath(path: readonly Key[], ast: Ast, env: Env): Env {
	// path が空の場合
	if (path.length === 0) {
		return env.pushed(ast)
	}

	const [first, ...rest] = path

	// . から始まる場合
	if (first === Current) {
		if (rest.length === 0) {
			return env.pushed(ast)
		}

		const [second, ...rest1] = rest

		if (second === Current || second === Parent) {
			// ././x -> ./x
			// ./../x -> ../x
			// に縮約する
			return resolvePath([second, ...rest1], ast, env)
		}

		// ./x/y だった場合、現在のastから x に該当する「子」のASTを探し、
		// そこを基準として ./y を解決する
		const child = findAstByKey(ast, second)
		const innerEnv = env.pushed(ast)
		return resolvePath([Current, ...rest1], child, innerEnv)
	} else if (first === Parent) {
		// .. だった場合、現在の環境を返す
		if (rest.length === 0) {
			return env
		}

		const [second, ...rest1] = rest

		if (second === Current || second === Parent) {
			// .././x -> ./x
			// ../../x -> ../x
			// に縮約し、親基準で再帰
			const parent = env.ast
			const parentEnv = env.parent ?? env
			return resolvePath([second, ...rest1], parent, parentEnv)
		}

		// ../x/y だった場合、親のastから x に該当する「おば」のASTを探す
		const aunt = findAstByKey(env.ast, second)
		const parentEnv = env.parent ?? env
		return resolvePath([Current, ...rest1], aunt, parentEnv)
	} else {
		// それ以外の場合、Scopeにぶち当たるまで親をたどる
		let currentEnv: Env | undefined = env
		while (currentEnv) {
			if (currentEnv.ast instanceof Scope && first in currentEnv.ast.vars) {
				const found = currentEnv.ast.vars[first]
				return resolvePath(rest, found, currentEnv)
			}
			currentEnv = currentEnv.parent
		}
		throw new Error(`Not found: ${first}`)
	}
}

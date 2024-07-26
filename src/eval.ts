import {
	Ast,
	Current,
	Dict,
	DictLiteral,
	Fn,
	isAstObject,
	Key,
	List,
	Parent,
	Scope,
	Sym,
	unit,
	Value,
	Vector,
	VectorLiteral,
} from './ast'
import {Env} from './env'
import {findAstByKey} from './findAstByKey'
import {Prelude} from './prelude'

const GlobalEnv = new Env(Prelude)

export function evaluate(ast: Ast, env = GlobalEnv): Value {
	if (!isAstObject(ast)) {
		return ast
	}

	switch (ast.type) {
		case 'List':
			return evaluateList(ast, env)
		case 'Scope':
			return evaluateScope(ast, env)
		case 'Sym':
			return evaluateSym(ast, env)
		case 'VectorLiteral':
			return evaluateVector(ast, env)
		case 'DictLiteral':
			return evaluateDict(ast, env)
	}

	return ast
}

function evaluateList(ast: List, env: Env): Value {
	const innerEnv = env.push(ast)
	const f = evaluate(ast.car, innerEnv)
	const args = ast.cdr.map(e => evaluate(e, innerEnv))

	if (f instanceof Fn) {
		return f.fn(...args)
	} else {
		return f
	}
}

function evaluateVector(ast: VectorLiteral, env: Env): Vector {
	const innerEnv = env.push(ast)
	return ast.items.map(e => evaluate(e, innerEnv))
}

function evaluateDict(ast: DictLiteral, env: Env): Dict {
	const innerEnv = env.push(ast)

	return Object.fromEntries(
		ast.entries.map(([k, v]) => [k, evaluate(v, innerEnv)])
	)
}

function evaluateSym(ast: Sym, env: Env): Value {
	let resolved: Env
	try {
		resolved = resolvePath(ast.path, ast, env)
	} catch (e) {
		return unit
	}

	const value = evaluate(resolved.ast, resolved.parent)

	return value
}

function resolvePath(path: readonly Key[], ast: Ast, env: Env): Env {
	// path が空の場合
	if (path.length === 0) {
		return env.push(ast)
	}

	const [first, ...rest] = path

	// . から始まる場合
	if (first === Current) {
		if (rest.length === 0) {
			return env.push(ast)
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
		const innerEnv = env.push(ast)
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

function evaluateScope(ast: Scope, env: Env): Value {
	const innerEnv = env.push(ast)
	if (ast.ret) {
		return evaluate(ast.ret, innerEnv)
	} else {
		return unit
	}
}

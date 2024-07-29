import {
	Ast,
	Dict,
	DictLiteral,
	Expr,
	Fn,
	isValue,
	List,
	Scope,
	Sym,
	unit,
	Value,
	Vector,
	VectorLiteral,
} from './ast'
import {Env} from './env'
import {Prelude} from './prelude'
import {resolvePath} from './resolvePath'
import {NestedWeakMap, NestedWeakSet} from './util/NestedWeak'

export const GlobalEnv = new Env(Prelude)

const EvalCache = new NestedWeakMap<Env, Expr, Value>()

const Evaluating = new NestedWeakSet<Env, Expr>()

export function evaluate(ast: Ast, env = GlobalEnv): Value {
	if (isValue(ast)) {
		return ast
	}

	// キャッシュがあればそれを返す
	const cache = EvalCache.get(env, ast)
	if (cache) {
		return cache
	}

	// 循環参照を検出
	if (Evaluating.has(env, ast)) {
		// throw new Error('Cyclic reference')
		return unit
	}

	// 評価中の式としてマーク
	Evaluating.add(env, ast)

	// 評価
	let ret: Value
	try {
		switch (ast.type) {
			case 'List':
				ret = evaluateList(ast, env)
				break
			case 'Scope':
				ret = evaluateScope(ast, env)
				break
			case 'Sym':
				ret = evaluateSym(ast, env)
				break
			case 'VectorLiteral':
				ret = evaluateVector(ast, env)
				break
			case 'DictLiteral':
				ret = evaluateDict(ast, env)
				break
		}
	} finally {
		// 評価中の式としてのマークを外す
		Evaluating.delete(env, ast)
	}

	EvalCache.set(env, ast, ret)

	return ret
}

function evaluateList(ast: List, env: Env): Value {
	const innerEnv = env.pushed(ast)
	const f = evaluate(ast.car, innerEnv)
	const args = ast.cdr.map(e => evaluate(e, innerEnv))

	if (f instanceof Fn) {
		return f.fn(...args)
	} else {
		return f
	}
}

function evaluateVector(ast: VectorLiteral, env: Env): Vector {
	const innerEnv = env.pushed(ast)
	return ast.items.map(e => evaluate(e, innerEnv))
}

function evaluateDict(ast: DictLiteral, env: Env): Dict {
	const innerEnv = env.pushed(ast)

	return Object.fromEntries(
		ast.entries.map(([k, v]) => [k, evaluate(v, innerEnv)])
	)
}

function evaluateSym(ast: Sym, env: Env): Value {
	let resolved: {ast: Ast; env?: Env}
	try {
		resolved = resolvePath(ast.path, ast, env)
	} catch (e) {
		return unit
	}

	const value = evaluate(resolved.ast, resolved.env)

	return value
}

function evaluateScope(ast: Scope, env: Env): Value {
	const innerEnv = env.pushed(ast)
	if (ast.ret) {
		return evaluate(ast.ret, innerEnv)
	} else {
		return unit
	}
}

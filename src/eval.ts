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
import {PreludeEnv} from './prelude'
import {resolvePath} from './resolvePath'
import {NestedWeakMap, NestedWeakSet} from './util/NestedWeak'

/**
 * The cache for the evaluation result
 */
const EvalCache = new NestedWeakMap<Env, Expr, Value>()

/**
 * The set for the expressions being evaluated, for detecting cyclic reference
 */
const Evaluating = new NestedWeakSet<Env, Expr>()

export function evaluate(ast: Ast, env = PreludeEnv): Value {
	// Return as it is if it is a Value
	if (isValue(ast)) {
		return ast
	}

	// Return the cache if it exists
	const cache = EvalCache.get(env, ast)
	if (cache) {
		return cache
	}

	// Detect cyclic reference
	if (Evaluating.has(env, ast)) {
		// throw new Error('Cyclic reference')
		return unit
	}

	// Mark as an expression being evaluated
	Evaluating.add(env, ast)

	// Evaluate the expression
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
		// Unmark as an expression being evaluated
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

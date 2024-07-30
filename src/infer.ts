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
import {evaluate} from './eval'
import {PreludeEnv} from './prelude'
import {resolvePath} from './resolvePath'
import {NestedWeakMap, NestedWeakSet} from './util/NestedWeak'

const InferCache = new NestedWeakMap<Env, Expr, Value>()

const Inferring = new NestedWeakSet<Env, Expr>()

export function infer(ast: Ast, env = PreludeEnv): Value {
	// Return as it is if it is a Value
	if (isValue(ast)) {
		return ast
	}

	// Return the cache if it exists
	const cache = InferCache.get(env, ast)
	if (cache) {
		return cache
	}

	// Detect cyclic reference
	if (Inferring.has(env, ast)) {
		return unit
	}

	// Mark as an expression being inferred
	Inferring.add(env, ast)

	let ret: Value
	try {
		switch (ast.type) {
			case 'List':
				ret = inferList(ast, env)
				break
			case 'Sym':
				ret = inferSym(ast, env)
				break
			case 'VectorLiteral':
				ret = inferVector(ast, env)
				break
			case 'DictLiteral':
				ret = inferDict(ast, env)
				break
			case 'Scope':
				ret = inferScope(ast, env)
				break
		}
	} finally {
		// Unmark as an expression being inferred
		Inferring.delete(env, ast)
	}

	InferCache.set(env, ast, ret)

	return ret
}

function inferList(ast: List, env: Env): Value {
	const car = evaluate(ast.car, env.pushed(ast))

	if (car instanceof Fn) {
		return car.fnType.ret
	}

	return car
}

function inferVector(ast: VectorLiteral, env: Env): Vector {
	const innerEnv = env.pushed(ast)
	return ast.items.map(e => infer(e, innerEnv))
}

function inferDict(ast: DictLiteral, env: Env): Dict {
	const innerEnv = env.pushed(ast)

	return Object.fromEntries(
		ast.entries.map(([k, v]) => [k, infer(v, innerEnv)])
	)
}

function inferScope(ast: Scope, env: Env): Value {
	if (!ast.ret) {
		return unit
	}

	return infer(ast.ret, env.pushed(ast))
}

function inferSym(ast: Sym, env: Env): Value {
	let resolved: {ast: Ast; env?: Env}
	try {
		resolved = resolvePath(ast.path, env.ast, env.parent)
	} catch (e) {
		return unit
	}

	const value = infer(resolved.ast, resolved.env)

	return value
}

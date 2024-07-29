import {
	Ast,
	Dict,
	DictLiteral,
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

export const GlobalEnv = new Env(Prelude)

export function evaluate(ast: Ast, env = GlobalEnv): Value {
	if (isValue(ast)) {
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

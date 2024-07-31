import {range} from 'lodash'

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
	Unit,
	unit,
	Value,
	Vector,
	VectorLiteral,
} from './ast'
import {Env} from './env'
import {defaultOf} from './getDefault'
import {argTypeMismatchLog, Log} from './Log'
import {PreludeEnv} from './prelude'
import {resolvePath} from './resolvePath'
import {isInstance} from './TypeOperations'
import {NestedWeakMap, NestedWeakSet} from './util/NestedWeak'

/**
 * The cache for the evaluation result
 */
const EvalCache = new NestedWeakMap<Env, Expr, Value>()

/**
 * The set for the expressions being evaluated, for detecting cyclic reference
 */
const Evaluating = new NestedWeakSet<Env, Expr>()

const EvalLog = new NestedWeakMap<Env, Expr, Log[]>()

function throwLog(log: Log): void {
	Evaluating.forEach((env, ast) => {
		const logs = EvalLog.get(env, ast) ?? []
		EvalLog.set(env, ast, [...logs, log])
	})
}

export function getLogs(ast: Ast, env: Env): Log[] {
	if (isValue(ast)) {
		return []
	}
	return EvalLog.get(env, ast) ?? []
}

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
		throwLog({
			level: 'error',
			reason: ['Cyclic reference'],
			callstack: {ast, env},
		})
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

	if (!(f instanceof Fn)) {
		// 関数呼び出しできない場合、定数関数としてそれ自身を返す
		return f
	}

	// 型検査。引数の評価後の型が正しいか
	const expectedTypes = f.fnType.argsByLength(args.length)

	// 必須引数が足りない場合
	if (args.length < expectedTypes.length) {
		throwLog({
			level: 'error',
			reason: [
				`Too few arguments. Expected ${expectedTypes.length}, but got ${args.length}`,
			],
			callstack: {ast, env},
		})
	}

	for (const index of range(expectedTypes.length)) {
		const arg = args[index]
		const [name, expectedType] = expectedTypes[index]

		if (isInstance(arg, expectedType)) {
			continue
		}

		// 実引数の型が仮引数の型と一致しない場合, デフォルト値を用いる
		const defaultValue = defaultOf(expectedType)
		args[index] = defaultValue

		// ユニット値の場合、無警告でスルー
		if (arg instanceof Unit) {
			continue
		}

		// それ以外の場合、方の不一致エラーを出力
		throwLog(
			argTypeMismatchLog({
				index,
				name,
				arg,
				expectedType,
				defaultValue,
				callstack: {ast, env},
			})
		)
	}

	return f.fn(...args)
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
		resolved = resolvePath(ast.path, env.ast, env.parent)
	} catch (e) {
		throwLog({
			level: 'error',
			reason: ['Symbol ', ast, ' is not defined'],
			callstack: {ast, env},
		})
		return unit
	}

	const value = evaluate(resolved.ast, resolved.env)

	return value
}

function evaluateScope(ast: Scope, env: Env): Value {
	if (!ast.ret) {
		return unit
	}

	return evaluate(ast.ret, env.pushed(ast))
}

import {keys} from 'lodash'

import {
	Ast,
	DictLiteral,
	Fn,
	isAstObject,
	List,
	Scope,
	VectorLiteral,
} from './ast'

/**
 * そのASTの中から指定されたキーを持つASTを返す。シンボル解決に使う。
 */
export function findAstByKey(ast: Ast, key: number | string): Ast {
	if (typeof ast !== 'object') {
		throw new Error('Not an object')
	}

	if (isAstObject(ast)) {
		switch (ast.type) {
			case 'List':
				return findFromList(ast, key)
			case 'Scope':
				return findFromScope(ast, key)
			case 'DictLiteral':
				return findFromDict(ast, key)
			case 'VectorLiteral':
				return findFromVector(ast, key)
		}

		throw new Error(`Not has key ${key}`)
	}

	if (Array.isArray(ast)) {
		if (typeof key === 'number') {
			return at(ast, key)
		} else {
			throw new Error(`Not has key ${key}`)
		}
	}

	if (key in ast) {
		return ast[key]
	}

	throw new Error(`Not has key ${key}`)
}

function findFromList(ast: List, key: number | string): Ast {
	if (typeof key === 'number') {
		return at(ast.items, key)
	}

	if (key === '=>') {
		return ast.car
	}

	if (!(ast.car instanceof Fn)) {
		throw new Error('Not a function')
	}

	const index = keys(ast.car.fnType.args).indexOf(key)

	if (index === -1) {
		throw new Error(`Not has key ${key}`)
	}

	return at(ast.cdr, index)
}

function findFromScope(ast: Scope, key: number | string): Ast {
	if (key === 'return') {
		if (ast.ret) {
			return ast.ret
		}
		throw new Error('Scope has no return')
	}

	if (key in ast.vars) {
		return ast.vars[key]
	}

	throw new Error(`Not has key ${key}`)
}

function findFromVector(ast: VectorLiteral, key: number | string): Ast {
	if (typeof key === 'number') {
		return at(ast.items, key)
	}

	throw new Error(`Not has key ${key}`)
}

function findFromDict(ast: DictLiteral, key: number | string): Ast {
	if (typeof key === 'string') {
		const entry = ast.entries.find(([k]) => k === key)
		if (entry) {
			return entry[1]
		}
	}

	throw new Error(`Not has key ${key}`)
}

function at<T>(arr: readonly T[], index: number): T {
	const ret = arr[index]
	if (ret === undefined) {
		throw new Error('Index out of bounds')
	}
	return ret
}

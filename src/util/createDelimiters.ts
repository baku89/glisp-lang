import {CompoundExpr, Scope} from '../ast'

export function createDelimiters(ast: CompoundExpr): readonly string[] {
	switch (ast.type) {
		case 'List':
		case 'VectorLiteral':
			return createSeqDelimiters(ast.items.length)
		case 'DictLiteral':
			return createDictDelimiters(ast.entries.length, ['', ' '])
		case 'Scope':
			return createScopeDelimiters(ast)
	}
}

function createSeqDelimiters(length: number): string[] {
	if (length === 0) {
		return ['']
	} else if (length === 1) {
		return ['', '']
	} else {
		return ['', ...Array(length - 1).fill(' '), '']
	}
}

/**
 * キー
 * @param length エントリーの個数
 * @returns
 */
function createDictDelimiters(
	length: number,
	infixDelimiters: [string, string]
) {
	if (length === 0) {
		// { _ }
		return ['']
	} else if (length === 1) {
		return [
			// { _
			'',
			// a (infix0) × (infix1) A
			...infixDelimiters,
			// _ }
			'',
		]
	} else {
		return [
			// { _
			'',
			//   a (infix0) × (infix1) A __
			//   b (infix0) × (infix1) B __
			...Array(length - 1)
				.fill([...infixDelimiters, ' '])
				.flat(),
			//   c (infix0) × (infix1) C
			...infixDelimiters,
			//  _ }
			'',
		]
	}
}

function createScopeDelimiters(scope: Scope): readonly string[] {
	const entriesLength = Object.entries(scope.vars).length
	const delimiters = createDictDelimiters(entriesLength, [' ', ' '])

	if (scope.ret) {
		delimiters.pop()
		delimiters.push(' ', '')
	}

	return delimiters
}

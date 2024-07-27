import {List, Scope, VectorLiteral} from '../ast'

export function createSeqDelimiters(seq: List | VectorLiteral) {
	const length = seq.length

	if (length === 0) {
		return ['']
	} else if (length === 1) {
		return ['', '']
	} else {
		return ['', ...Array(length - 1).fill(' '), '']
	}
}

export function createDictDelimiters(length: number) {
	if (length === 0) {
		return ['']
	} else if (length === 1) {
		// { _ a _ : __ 20 _ }
		return ['', '', ' ', '']
	} else {
		// { _ a _ : _ 20 __ b _ : _ 30 _ }
		return [
			'',
			...Array(length - 1)
				.fill(['', '', ' '])
				.flat(),
			'',
			' ',
			'',
		]
	}
}

export function createScopeDelimiters(scope: Scope) {
	const delimiters = createDictDelimiters(scope.vars)

	if (scope.ret) {
		delimiters.pop()
		delimiters.push(' ', '')
	}

	return delimiters
}

/**
 * Creates delimiters for S-expression.
 * e.g. if count=2, returns ['', ' ', ' ', '']
 * @param count: Number of elements
 */
export function createListDelimiters(count: number): string[] {
	if (count === 0) {
		return ['']
	} else {
		return ['', ...Array(count - 1).fill(' '), '']
	}
}

export function insertDelimiters(
	elements: readonly string[],
	delimiters: readonly string[]
) {
	if (elements.length + 1 !== delimiters.length) {
		throw new Error(
			'Invalid length of delimiters. elements=' +
				JSON.stringify(elements) +
				' delimiters=' +
				JSON.stringify(delimiters)
		)
	}

	let str = delimiters[0]

	for (let i = 0; i < elements.length; i++) {
		str += elements[i] + delimiters[i + 1]
	}

	return str
}

/**
 *
 * @param delimiters Mutated in the function
 */
export function increaseDelimiter(delimiters: string[]) {
	if (delimiters.length === 0) {
		throw new Error('Invalid delimiters')
	} else if (delimiters.length === 1) {
		delimiters.push('')
	} else if (delimiters.length === 2) {
		delimiters.splice(1, 0, ' ')
	} else {
		// TODO: コメントがずれる
		delimiters.splice(-1, 0, delimiters.at(-2) as string)
	}
}

export function removeDelimiter(delimiters: string[], at: number) {
	if (delimiters.length < 2) {
		throw new Error('Invalid delimiters')
	} else if (at + 1 >= delimiters.length) {
		throw new Error('Invalid index')
	} else {
		delimiters.splice(at + 1, 1)
	}
}

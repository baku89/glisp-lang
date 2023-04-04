/**
 * Creates an object from keys and values. The superflous values are ignored.
 */
export function fromKeysValues<T>(
	keys: readonly string[],
	values: readonly T[]
) {
	if (keys.length > values.length) {
		throw new Error('the number of values are less than the number of keys.')
	}

	const items: Record<string, T> = {}

	for (let i = 0; i < keys.length; i++) {
		items[keys[i]] = values[i]
	}

	return items
}

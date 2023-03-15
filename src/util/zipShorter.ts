/**
 * Almost same as lodash's zip, but it ignores superflous elements of longer arrays while the lodash version automatically fills with undefined
 */
export function zipShorter<T, U>(array1: readonly T[], array2: readonly U[]) {
	const len = Math.min(array1.length, array2.length)
	const zipped: [T, U][] = []
	for (let i = 0; i < len; i++) {
		zipped.push([array1[i], array2[i]])
	}
	return zipped
}

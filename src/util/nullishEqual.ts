/**
 * Evaluates the equality of two values when both are not nullish. Also returns true if both are nullish
 */
export function nullishEqual<T>(
	a: T | null | undefined,
	b: T | null | undefined,
	isEqual: (x: T, y: T) => boolean
): boolean {
	const isANullish = a === null || a === undefined
	const isBNullish = b === null || b === undefined

	if (!isANullish && !isBNullish) {
		// If both are not nullish values, then evaluate the equality
		return isEqual(a, b)
	}
	if (isANullish && isBNullish) {
		// If both are nullish, return true
		return true
	}
	// Otherwise, it means that only either one is nullish
	return false
}

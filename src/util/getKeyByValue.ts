export function getKeyByValue<T>(
	object: Record<string, T>,
	value: T
): string | null {
	return Object.keys(object).find(key => object[key] === value) ?? null
}

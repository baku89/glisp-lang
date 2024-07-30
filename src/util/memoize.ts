import {isObject} from 'lodash'

/**
 * the decorator for class method memoization
 */
export function memoize() {
	return (target: any, name: string, descriptor: PropertyDescriptor) => {
		const original = descriptor.value
		const memoized = new WeakMap()
		descriptor.value = function (arg: unknown) {
			if (!isObject(arg)) {
				return original.apply(this, arg)
			}
			if (!memoized.has(arg)) {
				memoized.set(arg, original.apply(this, arg))
			}
			return memoized.get(arg)
		}
		return descriptor
	}
}

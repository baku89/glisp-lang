import {
	All,
	Dict,
	FnType,
	isAstObject,
	isDict,
	Never,
	Typeclass,
	Value,
	Vector,
} from './ast'
import {isEqual} from './isEqual'
import {Boolean, Number, String} from './prelude'

export function isSubtypeOf(a: Value, b: Value): boolean {
	if (isEqual(a, b)) {
		return true
	}

	if (b instanceof All) {
		return true
	}

	if (b instanceof Never) {
		return false
	}

	if (a instanceof Never) {
		return true
	}

	switch (typeof a) {
		case 'number':
			return isEqual(b, Number)
		case 'string':
			return isEqual(b, String)
		case 'boolean':
			return isEqual(b, Boolean)
	}

	if (isAstObject(a)) {
		switch (a.type) {
			case 'All':
			case 'Unit':
			case 'Type':
				return false
			case 'Atom':
				return isEqual(a.superType, b)
			case 'Fn':
				return b instanceof FnType && isFnTypeSubtypeOf(a.fnType, b)
			case 'FnType':
				return b instanceof FnType && isFnTypeSubtypeOf(a, b)
			case 'Typeclass':
				return (
					b instanceof Typeclass &&
					a.id === b.id &&
					a.args.every((v, i) => isSubtypeOf(v, b.args[i]))
				)
		}
	}

	if (Array.isArray(a)) {
		return Array.isArray(b) && isVectorSubtypeOf(a, b)
	}

	if (isDict(a)) {
		return isDict(b) && isDictSubtypeOf(a, b)
	}

	throw new Error('Not implemented')
}

function isVectorSubtypeOf(a: Vector, b: Vector): boolean {
	return a.length >= b.length && b.every((bi, i) => isSubtypeOf(a[i], bi))
}

function isDictSubtypeOf(a: Dict, b: Dict): boolean {
	return Object.entries(b).every(([k, bv]) => {
		return k in a && isSubtypeOf(a[k], bv)
	})
}

function isFnTypeSubtypeOf(a: FnType, b: FnType): boolean {
	return (
		isSubtypeOf(b.ret, a.ret) &&
		isVectorSubtypeOf(Object.values(b.args), Object.values(a.args))
	)
}

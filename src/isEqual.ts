import {isAstObject, isDict, Value} from './ast'
import {isEqualArray} from './util/isEqualArray'
import {isEqualDict} from './util/isEqualDict'

/**
 * 値の同値関係を判定する。参照は違えど、意味論的に同じものは同値とみなす。
 */
export function isEqual(a: Value, b: Value): boolean {
	if (a === b) {
		return true
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		return isEqualArray(a, b, isEqual)
	}

	if (isDict(a) && isDict(b)) {
		return isEqualDict(a, b, isEqual)
	}

	if (isAstObject(a) && isAstObject(b)) {
		switch (a.type) {
			case 'All':
			case 'Unit':
			case 'Never':
				return a.type === b.type
			case 'Atom':
				return b.type === 'Atom' && a.value === b.value
			case 'Fn':
				return b.type === 'Fn' && a.fn === b.fn && isEqual(a.fnType, b.fnType)
			case 'FnType':
				return (
					b.type === 'FnType' &&
					isEqualArray(Object.values(a.args), Object.values(b.args), isEqual) &&
					isEqual(a.ret, b.ret)
				)
			case 'Type':
				return b.type === 'Type' && a.id === b.id
			case 'Typeclass':
				return b.type === 'Typeclass' && a.id === b.id
		}
	}

	return false
}

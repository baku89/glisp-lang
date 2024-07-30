import {isAstObject, unit, Value} from './ast'

export function defaultOf(type: Value): Value {
	switch (typeof type) {
		case 'number':
		case 'string':
		case 'boolean':
			return type
	}

	if (isAstObject(type)) {
		switch (type.type) {
			case 'All':
			case 'Unit':
				return unit
			case 'Atom':
			case 'Fn':
				return type
			case 'Never':
				throw new Error('不定です')
			case 'Type':
				return type.defaultValue
			case 'FnType':
				return defaultOf(type.ret)
			case 'Typeclass':
				throw new Error('Not yet implemented')
		}
	}
}

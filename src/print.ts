import {Ast} from './ast'

export function print(ast: Ast) {
	// if (ast instanceof Array) {
	// 	return '[' + ast.map(print).join(' ') + ']'
	// }
	// switch (typeof ast) {
	// 	case 'string':
	// 	case 'number':
	// 	case 'boolean':
	// 	case 'symbol':
	// 		return String(ast)
	// 	default:
	// 		if (ast === null) {
	// 			return 'null'
	// 		}
	// 		if (EType in ast) {
	// 			switch (ast[EType]) {
	// 				case 'Sym':
	// 					return [ast.path.join('/'), ...ast.keys.map(String)].join('.')
	// 				case 'App':
	// 					return (
	// 						'(' + print(ast.fn) + ' ' + ast.args.map(print).join(' ') + ')'
	// 					)
	// 				case 'Scope': {
	// 					const vars = Object.entries(ast.vars).map(
	// 						([k, e]) => `${k} = ${print(e)}`
	// 					)
	// 					const ret = ast.ret ? [print(ast.ret)] : []
	// 					return '{' + [...vars, ...ret].join(' ') + '}'
	// 				}
	// 			}
	// 		}
	// }
}

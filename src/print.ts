import {Ast, Current, isAstObject, Parent, Scope, Sym} from './ast'
import {getDelimiters} from './parse'

export function print(ast: Ast): string {
	if (ast instanceof Array) {
		return '[' + ast.map(print).join(' ') + ']'
	}
	switch (typeof ast) {
		case 'string':
		case 'number':
		case 'boolean':
			return String(ast)
		default:
			if (isAstObject(ast)) {
				switch (ast.type) {
					case 'Sym':
						return printSym(ast)
					case 'List':
						return printSeq(ast.items, '(', ')', getDelimiters(ast))
					case 'VectorLiteral':
						return printSeq(ast.items, '[', ']', getDelimiters(ast))

					// 			switch (ast[EType]) {
					// 				case 'Sym':
					// 					return [ast.path.join('/'), ...ast.keys.map(String)].join('.')
					// 				case 'App':
					// 					return (
					// 						'(' + print(ast.fn) + ' ' + ast.args.map(print).join(' ') + ')'
					// 					)
					case 'Scope': {
						const vars = Object.entries(ast.vars).map(
							([k, e]) => `${k} = ${print(e)}`
						)
						const ret = ast.ret ? [print(ast.ret)] : []
						return '{' + [...vars, ...ret].join(' ') + '}'
					}
				}
			}
	}
}

function printSeq(
	asts: readonly Ast[],
	open: string,
	close: string,
	delimiters: readonly string[]
) {
	let result = open
	for (let i = 0; i < asts.length; i++) {
		result += delimiters[i] + print(asts[i])
	}
	return result + delimiters[asts.length] + close
}

function printSym(ast: Sym) {
	const path = ast.path
		.map(v => (v === Current ? '.' : v === Parent ? '..' : v))
		.join('/')

	const props = ast.props.join('.')

	return path + props
}

function printScope(ast: Scope) {
	const vars = Object.entries(ast.vars)

	// const vars = Object.entries(ast.vars).map(
	// 	([k, e]) => `${k} = ${print(e)}`
	// )
	// const ret = ast.ret ? [print(ast.ret)] : []
	// return '{' + [...vars, ...ret].join(' ') + '}'
}

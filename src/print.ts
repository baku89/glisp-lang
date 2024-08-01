import {Ast, Current, DictLiteral, isAstObject, Parent, Scope, Sym} from './ast'
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
					case 'All':
						return '***'
					case 'Unit':
						return '()'
					case 'Never':
						return '_|_'
					case 'Sym':
						return printSym(ast)
					case 'List':
						return printSeq(ast.items, '(', ')', getDelimiters(ast))
					case 'VectorLiteral':
						return printSeq(ast.items, '[', ']', getDelimiters(ast))
					case 'DictLiteral':
						return printDictLiteral(ast)
					case 'Scope':
						return printScope(ast)
					case 'Atom':
						return print(ast.toAst())
					case 'Type':
						return ast.id
				}
			}
	}

	throw new Error('Not yet implemented ' + JSON.stringify(ast))
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

function printDictLiteral(ast: DictLiteral) {
	const vars = ast.entries.map(([k, e]) => {
		return `${k}: ${print(e)}`
	})
	return '{' + vars.join(' ') + '}'
}

function printScope(ast: Scope) {
	const vars = Object.entries(ast.vars).map(([k, e]) => {
		return `${k} = ${print(e)}`
	})
	const ret = ast.ret ? [print(ast.ret)] : []
	return '{' + [...vars, ...ret].join(' ') + '}'
}

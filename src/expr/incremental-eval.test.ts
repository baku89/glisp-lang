import type {ParentExpr} from '..'
import {Parser, PreludeScope} from '..'

export function tryParseExpr(input: string, parent: ParentExpr = PreludeScope) {
	const {expr} = Parser.Program.tryParse(input)
	if (!expr) throw new Error('Whitespace only')
	expr.parent = parent
	return expr
}

type Action = {
	path: string | number
	expr: string
}

describe('incremental evaluation', () => {
	testIncrementalEval('(let x: 10 x)', {path: 'x', expr: '20'}, '20')
	testIncrementalEval('(let x: 10 (** x 2))', {path: 'x', expr: '20'}, '400')
	testIncrementalEval('(let x: (+ 1 y) y: 10 x)', {path: 'y', expr: '20'}, '21')
	testIncrementalEval('(inc 10)', {path: 1, expr: '20'}, '21')
	testIncrementalEval('(len [1 2])', {path: 'x', expr: '[1 2 3]'}, '3')

	function testIncrementalEval(
		input: string,
		{path: name, expr}: Action,
		expected: string
	) {
		it(`${input}, (${name} -> ${expr}) evaluates to ${expected}`, () => {
			const target = tryParseExpr(input)
			target.parent = PreludeScope
			const newExpr = tryParseExpr(expr)
			const expectedValue = tryParseExpr(expected).eval().value

			target.eval()

			target.setChild(name, newExpr)

			const evaluated = target.eval().value

			if (!evaluated.isEqualTo(expectedValue)) {
				throw new Error(`Got=${evaluated.print()}`)
			}
		})
	}
})

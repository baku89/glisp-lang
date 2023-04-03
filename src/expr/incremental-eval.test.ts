import type {ParentExpr} from '..'
import {Parser, PreludeScope} from '..'

export function tryParseExpr(input: string, parent: ParentExpr = PreludeScope) {
	const {expr} = Parser.Program.tryParse(input)
	if (!expr) throw new Error('Whitespace only')
	expr.parent = parent
	return expr
}

type Action = {
	name: string
	expr: string
}

describe('incremental evaluation', () => {
	testIncrementalEval('(let x: 10 x)', {name: 'x', expr: '20'}, '20')
	testIncrementalEval('(let x: 10 (** x 2))', {name: 'x', expr: '20'}, '400')
	testIncrementalEval('(let x: (+ 1 y) y: 10 x)', {name: 'y', expr: '20'}, '21')

	function testIncrementalEval(
		input: string,
		{name, expr}: Action,
		expected: string
	) {
		it(`${input}, (${name} -> ${expr}) evaluates to ${expected}`, () => {
			const scope = Parser.Scope.tryParse(input)
			scope.parent = PreludeScope
			const newExpr = tryParseExpr(expr)
			const expectedValue = tryParseExpr(expected).eval().value

			scope.eval()

			scope.setChild(name, newExpr)

			const evaluated = scope.eval().value

			if (!evaluated.isEqualTo(expectedValue)) {
				throw new Error(`Got=${evaluated.print()}`)
			}
		})
	}
})

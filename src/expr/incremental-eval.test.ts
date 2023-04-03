import {Parser, PreludeScope} from '..'
import type {Expr} from '.'
import {Action} from './action'

export function $(input: TemplateStringsArray) {
	const {expr} = Parser.Program.tryParse(input[0])
	if (!expr) throw new Error('Whitespace only')
	expr.parent = PreludeScope
	return expr
}

describe('incremental evaluation', () => {
	test($`(let x: 10 x)`, {type: 'set', path: 'x', expr: $`20`}, $`20`)
	test($`(let x: 10 (** x 2))`, {type: 'set', path: 'x', expr: $`20`}, $`400`)
	test(
		$`(let x: (+ 1 y) y: 10 x)`,
		{type: 'set', path: 'y', expr: $`20`},
		$`21`
	)
	test($`(let x: 10 x)`, {type: 'delete', path: 'x'}, $`()`)
	test($`(let 10)`, {type: 'delete', path: 'return'}, $`()`)
	test($`(let x: 9 (+ x))`, {type: 'delete', path: 'x'}, $`0`)
	test($`(let x: 7 y: (+ x) y)`, {type: 'delete', path: 'x'}, $`0`)
	test($`(let x: 4 x)`, {type: 'delete', path: 'return'}, $`()`)

	test($`(inc 10)`, {type: 'set', path: 1, expr: $`20`}, $`21`)
	test($`(len [1 2])`, {type: 'set', path: 'x', expr: $`[1 2 3]`}, $`3`)

	test($`[0 1 2]`, {type: 'set', path: 1, expr: $`"m"`}, $`[0 "m" 2]`)
	test($`[0 1 2]`, {type: 'set', path: 1, expr: $`"m"`}, $`[0 "m" 2]`)

	function test(src: Expr, action: Action, expected: Expr) {
		it(`\`${src.print()}\` evaluates to \`${expected.print()}\``, () => {
			const expectedValue = expected.eval().value

			src.commit(action)

			const evaluated = src.eval().value

			if (!evaluated.isEqualTo(expectedValue)) {
				throw new Error(`Got=${evaluated.print()}`)
			}
		})
	}
})

import {Parser, PreludeScope} from '..'
import type {Expr} from '.'
import {Action} from './action'

function $(input: TemplateStringsArray) {
	const {expr} = Parser.Program.tryParse(input[0])
	if (!expr) throw new Error('Whitespace only')
	expr.parent = PreludeScope
	return expr
}

function printAction(action: Action) {
	const {type, path} = action
	const p = JSON.stringify(path)
	if (type === 'set') {
		return `action=${type}, path=${p}, expr=${action.expr.print()}`
	} else if (type === 'delete') {
		return `action=${type}, path=${p}`
	} else if (type === 'rename') {
		return `action=${type}, path=${p}, to=${action.to}`
	}
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
	test($`(let x)`, {type: 'set', path: 'x', expr: $`888`}, $`888`)
	test($`(let x: 5 x)`, {type: 'rename', path: 'x', to: 'y'}, $`()`)
	test($`(let x: 5 y)`, {type: 'rename', path: 'x', to: 'y'}, $`5`)

	test($`(inc 10)`, {type: 'set', path: 1, expr: $`20`}, $`21`)
	test($`(len [1 2])`, {type: 'set', path: 'x', expr: $`[1 2 3]`}, $`3`)

	test($`[0 1 2]`, {type: 'set', path: 1, expr: $`"m"`}, $`[0 "m" 2]`)
	test($`[0 1 2]`, {type: 'set', path: 1, expr: $`"m"`}, $`[0 "m" 2]`)
	test($`[./1]`, {type: 'set', path: 1, expr: $`42`}, $`[42 42]`)
	test($`[./1 "hey"]`, {type: 'delete', path: 1}, $`[()]`)

	function test(src: Expr, action: Action, expected: Expr) {
		it(
			`\`${src.print()}\` (` +
				printAction(action) +
				`) evaluates to \`${expected.print()}\``,
			() => {
				const expectedValue = expected.eval()

				src.eval()

				src.commit(action)

				// Print the modified AST to make sure delimiters are still valid
				src.print()

				const evaluated = src.eval()

				if (!evaluated.isEqualTo(expectedValue)) {
					throw new Error(`Got=${evaluated.print()}`)
				}
			}
		)
	}
})

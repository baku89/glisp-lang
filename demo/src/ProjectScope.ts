import chroma from 'chroma-js'
import * as G from 'glisp'

export const IO = G.primType('IO', () => {
	return
})

export const Color = G.primType('Color', chroma('black'), {
	primToExpr(prim) {
		const rgba = prim.value.rgba().map(G.literal)
		return G.app(G.symbol('rgba'), ...rgba)
	},
	primEqual(a, b) {
		return a.hex() === b.hex()
	},
})

export const replScope = G.PreludeScope.extend({
	IO: G.valueContainer(IO),
	Color: G.valueContainer(Color),
	rgba: G.valueContainer(
		G.fn(
			G.fnType(
				{
					red: G.NumberType,
					green: G.NumberType,
					blue: G.NumberType,
					alpha: G.NumberType,
				},
				Color
			),
			(red: G.Number, green: G.Number, blue: G.Number, alpha: G.Number) => {
				return new G.EvalResult(
					Color.of(chroma([red.value, green.value, blue.value, alpha.value]))
				)
			}
		)
	),
	'set!': G.valueContainer(
		G.fn(
			G.fnType({name: G.StringType, value: G.all}, IO),
			(name: G.String, value: G.Value) => {
				const _name = name.value

				const symbol = G.Parser.Symbol.parse(_name)
				if (!symbol.status) {
					return new G.EvalResult(G.unit).withLog({
						level: 'error',
						reason: `\`${_name}\` cannot be used as a symbol name`,
						ref: G.valueContainer(G.unit),
					})
				}

				return new G.EvalResult(
					IO.of(() => {
						projectScope.set(_name, value.toExpr())
					})
				)
			}
		)
	),
	'delete!': G.valueContainer(
		G.fn(G.fnType({name: G.StringType}, IO), (name: G.String) => {
			const _name = name.value

			const symbol = G.Parser.Symbol.parse(_name)
			if (!symbol.status) {
				return new G.EvalResult(G.unit).withLog({
					level: 'error',
					reason: `\`${_name}\` cannot be used as a symbol name`,
					ref: G.valueContainer(G.unit),
				})
			}

			return new G.EvalResult(
				IO.of(() => {
					projectScope.delete(_name)
				})
			)
		})
	),
})

export const projectScope = G.Parser.Scope.tryParse(
	`
(let a: (+ b 2)
     b: 123
     c: "hello"
     d: (let TAU: (* PI 2)
             E: 2.71828
             (+ TAU b))
     v: [1
         [0 (** 2 3) ()]
         (let y: 20 y)
         (+ 1 2)
         "foo"]
     g: (sqrt 2)
     a)`.trim()
)
projectScope.parent = replScope

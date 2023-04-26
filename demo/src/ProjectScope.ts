import chroma from 'chroma-js'
import * as G from 'glisp'
import {clamp} from 'lodash'

export const IO = G.primType('IO', () => {
	return
})

export const Color = G.primType('Color', chroma('black'), {
	primToExpr(prim) {
		const rgba: number[] = prim.value.rgba()
		if (rgba[3] === 1) {
			rgba.pop()
		}

		return G.app(G.symbol('Color'), ...rgba.map(G.literal))
	},
	primEqual(a, b) {
		return a.hex() === b.hex()
	},
	fn(Color) {
		return {
			f: (red: G.Number, green: G.Number, blue: G.Number, alpha: G.Number) => {
				return Color.of(
					chroma([red.value, green.value, blue.value, clamp(alpha.value, 0, 1)])
				)
			},
			fnType: G.fnType(
				{
					red: G.NumberType,
					green: G.NumberType,
					blue: G.NumberType,
					alpha: G.NumberType.withDefault(G.number(1)),
				},
				3,
				null,
				Color
			),
		}
	},
})

export const replScope = G.PreludeScope.extend({
	IO: G.container(IO),
	Color: G.container(Color),
	'set!': G.container(
		G.fn(
			G.fnType({name: G.StringType, value: G.all}, IO),
			(name: G.String, value: G.Value) => {
				const _name = name.value

				const symbol = G.Parser.Symbol.parse(_name)
				if (!symbol.status) {
					return G.unit.withLog({
						level: 'error',
						reason: `\`${_name}\` cannot be used as a symbol name`,
						ref: G.container(G.unit),
					})
				}

				return IO.of(() => {
					projectScope.set(_name, value.toExpr())
				})
			}
		)
	),
	'delete!': G.container(
		G.fn(G.fnType({name: G.StringType}, IO), (name: G.String) => {
			const _name = name.value

			const symbol = G.Parser.Symbol.parse(_name)
			if (!symbol.status) {
				return G.unit.withLog({
					level: 'error',
					reason: `\`${_name}\` cannot be used as a symbol name`,
					ref: G.container(G.unit),
				})
			}

			return IO.of(() => {
				projectScope.delete(_name)
			})
		})
	),
})

export const projectScope = G.Parser.Scope.tryParse(
	`
(let a: (+ b 2)
     b: 123
     c: "hello"
     w: b
     s: (let TAU: (* PI 2)
             E: 2.71828
             (+ TAU b))
     d: {foo: "banana" bar: "apple"}
     v: [1
         [0 (** 2 3) ()]
         (let y: 20 y)
         (+ 1 2)
         "foo"]
     g: (sqrt 2)
     a)`.trim()
)
projectScope.parent = replScope

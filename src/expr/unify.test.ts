import _, {fromPairs} from 'lodash'

import {
	boolean,
	BooleanType,
	fnType,
	isEqual,
	number as num,
	NumberType,
	TypeVar,
	typeVar,
	UnionType,
	unionType,
	unit,
	Value,
} from '../value'
import {Const, getTypeVars, Unifier} from './unify'

const T = typeVar('T'),
	U = typeVar('U'),
	T1 = typeVar('T1'),
	T2 = typeVar('T2'),
	T3 = typeVar('T3'),
	T4 = typeVar('T4'),
	T5 = typeVar('T5')

function ft(param: Value | Value[], ret: Value) {
	const _params = Array.isArray(param)
		? fromPairs(param.map((p, i) => [i, p]))
		: {0: param}
	return fnType(_params, ret)
}

describe('getTypeVars', () => {
	run(num(1), [])
	run(boolean(true), [])
	run(T, [T])
	run(unionType(T, U), [T, U])
	run(ft([BooleanType, T, T], U), [T, U])

	function run(ty: Value, expected: readonly TypeVar[]) {
		const eString = '{' + expected.map(e => e.print()).join(', ') + '}'

		test(`FV(${ty.print()}) equals to ${eString}`, () => {
			const tvs = [...getTypeVars(ty)]
			const diff = _.differenceWith(tvs, expected, isEqual)

			if (diff.length > 0) {
				throw new Error('Got={' + tvs.map(t => t.print()).join(', ') + '}')
			}
		})
	}
})

describe('unifyTypeVars', () => {
	test([[T, '>=', NumberType]], T, NumberType)
	test(
		[
			[T, '>=', unit],
			[T, '>=', NumberType],
		],
		T,
		UnionType.fromTypesUnsafe([unit, NumberType])
	)
	test([[NumberType, '>=', T]], T, NumberType)
	test(
		[
			[T, '>=', unit],
			[T, '>=', NumberType],
		],
		T,
		UnionType.fromTypesUnsafe([unit, NumberType])
	)
	test([[ft(ft(T1, T2), T3), '==', ft(T4, T5)]], T4, ft(T1, T2))
	test([[ft(T1, T2), '==', ft(T3, ft(T4, T5))]], T2, ft(T4, T5))
	test([[ft(T, U), '>=', ft(NumberType, NumberType)]], T, NumberType)
	test(
		[
			[ft(T1, T2), '>=', ft(NumberType, NumberType)],
			[ft(T2, T3), '>=', ft(NumberType, BooleanType)],
		],
		ft(T1, T3),
		ft(NumberType, BooleanType)
	)

	function test(consts: Const[], original: Value, expected: Value) {
		const cString = printConsts(consts)
		const oString = original.print()
		const eString = expected.print()
		const unifier = new Unifier(...consts)
		const resolved = unifier.substitute(original)

		it(`Under constraints ${cString}, σ(${oString}) equals to ${eString}`, () => {
			if (!resolved.isEqualTo(expected)) {
				throw new Error('Got=' + resolved.print())
			}
		})
	}

	function printConsts(consts: readonly Const[]) {
		const strs = consts
			.map(([s, R, t]) => [s.print(), R, t.print()].join(' '))
			.join(', ')

		return '{' + strs + '}'
	}
})

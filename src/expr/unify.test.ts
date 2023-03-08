import _, {fromPairs} from 'lodash'

import {
	bool,
	BoolType,
	fnType,
	isEqual,
	num,
	NumType,
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

function ft(param: Value | Value[], out: Value) {
	const _params = Array.isArray(param)
		? fromPairs(param.map((p, i) => [i, p]))
		: {0: param}
	return fnType({params: _params, out})
}

describe('getTypeVars', () => {
	run(num(1), [])
	run(bool(true), [])
	run(T, [T])
	run(unionType(T, U), [T, U])
	run(ft([BoolType, T, T], U), [T, U])

	function run(ty: Value, expected: TypeVar[]) {
		const eStr = '{' + expected.map(e => e.print()).join(', ') + '}'

		test(`FV(${ty.print()}) equals to ${eStr}`, () => {
			const tvs = [...getTypeVars(ty)]
			const diff = _.differenceWith(tvs, expected, isEqual)

			if (diff.length > 0) {
				throw new Error('Got={' + tvs.map(t => t.print()).join(', ') + '}')
			}
		})
	}
})

describe('unifyTypeVars', () => {
	test([[T, '>=', NumType]], T, NumType)
	test(
		[
			[T, '>=', unit],
			[T, '>=', NumType],
		],
		T,
		UnionType.fromTypesUnsafe([unit, NumType])
	)
	test([[NumType, '>=', T]], T, NumType)
	test(
		[
			[T, '>=', unit],
			[T, '>=', NumType],
		],
		T,
		UnionType.fromTypesUnsafe([unit, NumType])
	)
	test([[ft(ft(T1, T2), T3), '==', ft(T4, T5)]], T4, ft(T1, T2))
	test([[ft(T1, T2), '==', ft(T3, ft(T4, T5))]], T2, ft(T4, T5))
	test([[ft(T, U), '>=', ft(NumType, NumType)]], T, NumType)
	test(
		[
			[ft(T1, T2), '>=', ft(NumType, NumType)],
			[ft(T2, T3), '>=', ft(NumType, BoolType)],
		],
		ft(T1, T3),
		ft(NumType, BoolType)
	)

	function test(consts: Const[], original: Value, expected: Value) {
		const cStr = printConsts(consts)
		const oStr = original.print()
		const eStr = expected.print()
		const unifier = new Unifier(...consts)
		const resolved = unifier.substitute(original)

		it(`Under constraints ${cStr}, σ(${oStr}) equals to ${eStr}`, () => {
			if (!resolved.isEqualTo(expected)) {
				throw new Error('Got=' + resolved.print())
			}
		})
	}

	function printConsts(consts: Const[]) {
		const strs = consts
			.map(([s, R, t]) => [s.print(), R, t.print()].join(' '))
			.join(', ')

		return '{' + strs + '}'
	}
})

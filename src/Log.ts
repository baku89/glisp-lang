import ordinal from 'ordinal'
import {Ast, Value} from './ast'
import {type CallStack} from './CallStack'

/**
 * ログを格納する
 */
export interface Log {
	level: 'error' | 'warn' | 'info'
	/**
	 * ログの内容。['Symbol ', s`s`, ' is not defined']のように、式を保持したままログを出力する
	 */
	reason: (string | Ast)[]
	callstack: CallStack
}

/**
 * 実引数の方が仮引数の型と一致しないよ〜
 */
export function argTypeMismatchLog({
	index,
	name,
	arg,
	expectedType,
	defaultValue,
	callstack,
}: {
	index: number
	name: string
	arg: Value
	expectedType: Value
	defaultValue: Value
	callstack: CallStack
}): Log {
	const ord = ordinal(index + 1)

	return {
		level: 'error',
		reason: [
			`${ord} argument \`${name}\` expects type `,
			expectedType,
			', but got ',
			arg,
			'. Usees a default value ',
			defaultValue,
		],
		callstack,
	}
}

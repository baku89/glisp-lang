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
	reason: ([type: 'string', value: string] | [type: 'ast', value: Ast])[]
	callstack?: CallStack
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
			['string', `The ${ord} argument \`${name}\` expects type `],
			['ast', expectedType],
			['string', ', but got '],
			['ast', arg],
			['string', '. Uses a default value '],
			['ast', defaultValue],
		],
		callstack,
	}
}

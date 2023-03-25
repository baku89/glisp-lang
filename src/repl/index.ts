/* eslint-disable no-console */
import chalk from 'chalk'
import * as os from 'os'
import * as repl from 'repl'

import {EvalError} from '../EvalError'
import {app, Expr, valueContainer} from '../expr'
import {Log, WithLog, withLog} from '../log'
import {parse} from '../parser'
import {PreludeScope} from '../std/prelude'
import {
	all,
	fn,
	fnType,
	primType,
	String,
	StringType,
	unit,
	Value,
} from '../value'

const IO = primType('IO', () => {
	return
})

const defaultExpr = app()

function printLog({level, reason, ref}: Log) {
	let header: string
	switch (level) {
		case 'error':
			header = chalk.bold.inverse.red(' ERROR ')
			break
		case 'warn':
			header = chalk.bold.inverse.yellow('  WARN ')
			break
		case 'info':
			header = chalk.bold.inverse.blue('  INFO ')
			break
	}

	let content = header + ' ' + reason

	if (ref) {
		content += chalk.gray('\n    at ' + ref.print())
	}

	return content
}

const replScope = PreludeScope.extend({
	IO: valueContainer(IO),
	def: valueContainer(
		fn(
			fnType({name: StringType, value: all}, IO),
			(name: String, value: Value) =>
				withLog(
					IO.of(() => {
						replScope.items[name.value] = valueContainer(value)
					})
				)
		)
	),
	exit: valueContainer(IO.of(process.exit)),
})

function startRepl() {
	repl.start({
		prompt: chalk.bold.gray('> '),
		eval(input, _context, _file, cb) {
			let expr: Expr = defaultExpr

			// Parse
			try {
				expr = parse(input, replScope)
			} catch (err) {
				if (!(err instanceof Error)) throw err

				const reason =
					'Parsing error\n' +
					err.message
						.split('\n')
						.slice(2)
						.filter(s => !!s)
						.join('\n')

				const r = withLog(unit, {
					level: 'error',
					reason,
				})
				cb(null, r)
			}

			// Eval
			try {
				const evaluated = expr.eval()

				if (IO.isTypeFor(evaluated.result)) {
					evaluated.result.value()
				}

				cb(null, evaluated)
			} catch (err) {
				const r = withLog(unit, {
					level: 'error',
					reason: err instanceof Error ? err.message : 'Run-time error',
					ref: err instanceof EvalError ? err.ref : expr,
				})
				cb(null, r)
			}
		},
		writer: ({result, log}: WithLog) => {
			let str = ''

			for (const l of log) {
				str += printLog(l) + '\n'
			}

			str += chalk.bold.gray('< ') + result.print()

			return str + '\n'
		},
	})
}

function main() {
	console.log(`Hello ${os.userInfo().username}! Welcome to Glisp.`)
	startRepl()
}

main()

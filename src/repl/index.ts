/* eslint-disable no-console */
import chalk from 'chalk'
import * as os from 'os'
import * as repl from 'repl'

import * as Expr from '../expr'
import {GlispError} from '../GlispError'
import {Log, WithLog, withLog} from '../log'
import {parse} from '../parser'
import {PreludeScope} from '../std/prelude'
import {all, fn, primType, Str, StrType, unit, Value} from '../value'

const IO = primType('IO', () => {
	return
})

const defaultNode = Expr.app()

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

	const content = header + ' ' + reason
	const loc = ref !== defaultNode ? chalk.gray('\n    at ' + ref.print()) : ''

	return content + loc
}

const replScope = PreludeScope.extend({
	IO: Expr.value(IO),
	def: Expr.value(
		fn(
			{name: StrType, value: all},
			IO,
			(name: Expr.Arg<Str>, value: Expr.Arg<Value>) => {
				return withLog(
					IO.of(() => {
						replScope.vars[name().value] = Expr.value(value())
					})
				)
			}
		)
	),
	exit: Expr.value(IO.of(process.exit)),
})

function startRepl() {
	repl.start({
		prompt: chalk.bold.gray('> '),
		eval(input, _context, _file, cb) {
			let node: Expr.Node = defaultNode

			// Parse
			try {
				node = parse(input, replScope)
			} catch (err) {
				if (!(err instanceof Error)) throw err
				const r = withLog(unit, {
					level: 'error',
					reason: err.message,
					ref: node,
				})
				cb(null, r)
			}

			// Eval
			try {
				const evaluated = node.eval()

				if (IO.isTypeFor(evaluated.result)) {
					evaluated.result.value()
				}

				cb(null, evaluated)
			} catch (err) {
				const r = withLog(unit, {
					level: 'error',
					reason: err instanceof Error ? err.message : 'Run-time error',
					ref: err instanceof GlispError ? err.ref : node,
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

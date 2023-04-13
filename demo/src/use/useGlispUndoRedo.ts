import * as G from 'glisp'
import {inject, InjectionKey, provide} from 'vue'

interface GlispUndoRedoProvide {
	commit(expr: G.Expr, action: G.Action): void
	tagHistory(): void
	cancelTweak(): void
}

const GlispUndoRedoKey = Symbol() as InjectionKey<GlispUndoRedoProvide>

export const GlispUndoRedoProvideDefault: GlispUndoRedoProvide = {
	commit() {},
	tagHistory() {},
	cancelTweak() {},
}

export function useGlispUndoRedo() {
	interface MutationCommand {
		expr: G.Expr
		action: G.Action
		revAction: G.Action
	}

	const MAX_HISTORY = 1000

	// まだ履歴に追加される前のTweak中のコマンド
	let tweakCommands: MutationCommand[] = []

	let history: MutationCommand[][] = []

	let currentHistoryIndex = 0

	function commit(expr: G.Expr, action: G.Action) {
		const revAction = expr.commit(action)

		tweakCommands.push({expr, action, revAction})

		G.notifyChangedExprs()
	}

	function tagHistory() {
		if (currentHistoryIndex < history.length) {
			history.splice(currentHistoryIndex, history.length - currentHistoryIndex)
		}

		history.push(tweakCommands)
		history = history.slice(-MAX_HISTORY)

		tweakCommands = []

		currentHistoryIndex = history.length
	}

	function cancelTweak() {
		tweakCommands = []
	}

	function undo() {
		if (currentHistoryIndex === 0) return

		const commands = history[--currentHistoryIndex]

		commands.reverse().forEach(({expr, revAction}) => {
			expr.commit(revAction)
		})

		G.notifyChangedExprs()
	}

	provide(GlispUndoRedoKey, {commit, tagHistory, cancelTweak})

	return {undo}
}

export function injectGlispUndoRedo() {
	return inject(GlispUndoRedoKey, GlispUndoRedoProvideDefault)
}

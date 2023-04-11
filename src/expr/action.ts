import type {Expr} from '.'
import type {Key} from './path'

interface SetAction {
	type: 'set'
	path: Key
	expr: Expr
}

interface DeleteAction {
	type: 'delete'
	path: Key
}

interface RenameAction {
	type: 'rename'
	path: Key
	to: string
}

export type Action = SetAction | DeleteAction | RenameAction

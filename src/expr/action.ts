import type {Expr} from '.'

interface SetAction {
	type: 'set'
	path: string | number
	expr: Expr
}

interface DeleteAction {
	type: 'delete'
	path: string | number
}

interface RenameAction {
	type: 'rename'
	path: string | number
	to: string
}

export type Action = SetAction | DeleteAction | RenameAction

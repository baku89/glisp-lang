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

export type Action = SetAction | DeleteAction

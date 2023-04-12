import EventEmitter from 'eventemitter3'
import * as G from 'glisp'

const eventEmitter = new EventEmitter<{
	select: (expr: G.Expr) => void
	unselect: () => void
}>()

const manager = {
	on: eventEmitter.on.bind(eventEmitter),
	off: eventEmitter.off.bind(eventEmitter),
	onPointerEnter(expr: G.Expr) {
		eventEmitter.emit('select', expr)
	},
	onPointerLeave() {
		eventEmitter.emit('unselect')
	},
}

export function useGlispManager() {
	return manager
}

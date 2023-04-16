import EventEmitter from 'eventemitter3'
import * as G from 'glisp'
import {Ref, ref} from 'vue'

// Symbolのpick whip UIをドラッグした際、期待される値の型を保持
const symbolType = ref(G.never) as Ref<G.Value>

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
	symbolType,
}

export function useGlispManager() {
	return manager
}

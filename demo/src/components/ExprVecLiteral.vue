<script setup lang="ts">
import * as G from 'glisp'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Row from './Row.vue'

interface Props {
	expr: G.VecLiteral
	expectedType?: G.Value
	hovered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	expectedType: () => G.vec([], undefined, G.all),
	layout: 'expanded',
})

const {exprRef} = useExpr(props)

const emits = defineEmits<{
	(e: 'update:hovered', hovered: boolean): void
}>()

const {commit, tagHistory, cancelTweak} = injectGlispUndoRedo()

function set(path: number, expr: G.Expr) {
	commit(props.expr, {type: 'set', path, expr})
}

const manager = useGlispManager()

function onHover() {
	emits('update:hovered', true)
	manager.onPointerEnter(props.expr)
}

function onUnhover() {
	emits('update:hovered', false)
	manager.onPointerLeave()
}
</script>

<template>
	<div class="ExprVecLiteral" :class="{hovered}">
		<div
			class="hover-region"
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
		<Row
			v-for="(item, i) in exprRef.items"
			:key="i"
			:expr="item"
			@update:expr="set(i, $event)"
			@confirm="tagHistory"
			@cancel="cancelTweak"
		>
			<template #label>{{ i }}</template>
		</Row>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprVecLiteral
	position relative
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)
	font-family var(--font-ui)
	padding-left var(--ui-inspector-tree-icon-size)

	--border-color var(--color-outline-variant)
	--border-width 1px
	&.hovered
		--border-color var(--color-primary)
		--border-width 2px

	+box-before()
		left calc(var(--ui-input-height) / 3)
		width calc(var(--ui-input-row-margin) * .75)
		border var(--border-width) solid var(--border-color)
		border-right 0
		border-top 0
		bottom 0
		top calc(var(--ui-input-row-margin) * -1)
		input-transition(border)

	&.collapsed
		display grid
		grid-template-columns: repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
		gap var(--ui-input-gap)

.hover-region
	position absolute
	left 0
	top calc(var(--ui-input-row-margin) * -1)
	bottom 0
	width var(--ui-inspector-tree-icon-size)
</style>

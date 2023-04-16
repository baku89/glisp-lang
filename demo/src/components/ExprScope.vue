<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed} from 'vue'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Row from './Row.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Scope
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		expectedType: () => G.all,
		hovered: false,
	}
)

const emits = defineEmits<{
	(e: 'update:hovered', hovered: boolean): void
}>()

const {exprRef} = useExpr(props)

const items = computed(() => entries(exprRef.value.items))

const {commit, tagHistory, cancelTweak} = injectGlispUndoRedo()

function set(path: string, expr: G.Expr) {
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
	<div class="ExprScope expanded" :class="{hovered}">
		<div
			class="hover-region"
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
		<div class="items">
			<Row
				v-for="[path, item] in items"
				:key="path"
				:expr="item"
				@update:expr="set(path, $event)"
				@confirm="tagHistory"
				@cancel="cancelTweak"
			>
				<template #label>{{ path }}:</template>
			</Row>
		</div>
		<Row
			v-if="exprRef.ret"
			class="return"
			:expr="exprRef.ret"
			@update:expr="set('return', $event)"
			@confirm="tagHistory"
			@cancel="cancelTweak"
		>
			<template #label>Return</template>
		</Row>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprScope
	position relative
	font-family var(--font-ui)
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)

	--color-indent var(--color-outline-variant)

	&.hovered
		--color-indent var(--color-primary)

.items, .return
	padding-left var(--ui-inspector-tree-icon-size)

.items
	position relative
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)

	+box-before()
		left calc(var(--ui-inspector-tree-icon-size) / 2)
		width 0
		border-left 1px dashed var(--color-indent)
		height 100%

.return
	position relative
	border-style solid

	&:before, &:after
		content ''
		display block
		position absolute
		left calc(var(--ui-inspector-tree-icon-size) / 2)

	+box-before()
		width calc(var(--ui-input-row-margin) * .75)
		border-bottom-left-radius var(--ui-input-row-margin)
		border-left 3px solid var(--color-indent)
		border-bottom @border-left
		top calc(var(--ui-input-row-margin) * -1)
		bottom calc(var(--ui-input-row-margin) * -0.5)
		margin-left -1px

		&:first-child
			top 0

.hover-region
	position absolute
	left 0
	top calc(var(--ui-input-row-margin) * -1)
	bottom 0
	width var(--ui-inspector-tree-icon-size)
	z-index 10
</style>

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
		expr: G.DictLiteral
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
	<div class="ExprDictLiteral" :class="{hovered}">
		<div
			class="hover-region"
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
		<Row
			v-for="[path, e] in items"
			:key="path"
			:expr="e"
			@update:expr="set(path, $event)"
			@confirm="tagHistory"
			@cancel="cancelTweak"
		>
			<template #label>{{ path }}:</template>
		</Row>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprDictLiteral
	position relative
	font-family var(--font-ui)
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)
	padding-left var(--ui-inspector-tree-icon-size)

	.hovered:before
		border-color var(--color-primary)
		border-left-width 2px
		border-bottom-width 2px

	+box-before()
		top calc(var(--ui-input-row-margin) * -1)
		bottom 0
		left calc(var(--ui-inspector-tree-icon-size) / 2)
		border 1px solid var(--color-outline-variant)
		border-right 0
		border-top 0
		width calc(var(--ui-input-row-margin) * .75)
		border-bottom-left-radius 9999px

.hover-region
	position absolute
	left 0
	top calc(var(--ui-input-row-margin) * -1)
	bottom 0
	width var(--ui-inspector-tree-icon-size)
	z-index 10
</style>

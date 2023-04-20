<script setup lang="ts">
import {computed} from '@vue/reactivity'
import {useCssVar} from '@vueuse/core'
import * as G from 'glisp'
import {inject, provide, ref} from 'vue'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import Expr from './Expr.vue'
import ExprEvaluated from './ExprEvaluated.vue'
import ExprLiteral from './ExprLiteral.vue'
import ExprSymbol from './ExprSymbol.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Expr
		expectedType?: G.Value
	}>(),
	{
		expectedType: () => G.all,
	}
)

const {exprRef} = useExpr(props)

const expandable = computed(() => {
	const type = exprRef.value.type
	return type !== 'Literal' && type !== 'Symbol'
})

const expanded = ref(false)

defineEmits<{
	(e: 'update:expr', expr: G.Expr): void
	(e: 'confirm'): void
	(e: 'cancel'): void
}>()

function onClickChevron() {
	if (!expandable.value) return
	expanded.value = !expanded.value
}

const collapsedExprComponent = computed(() => {
	const type = exprRef.value.type
	if (type === 'Literal') {
		return ExprLiteral
	} else if (type === 'Symbol') {
		return ExprSymbol
	} else {
		return ExprEvaluated
	}
})

const icon = computed(() => {
	const type = exprRef.value.type
	if (type === 'App') {
		return 'schema'
	} else if (type === 'Scope') {
		return 'schema'
	} else {
		return null
	}
})

const manager = useGlispManager()

// Expr hover/unhover
const labelHovered = ref(false)
const exprHovered = ref(false)
const hovered = computed(() => labelHovered.value || exprHovered.value)

function onHoverLabel() {
	labelHovered.value = true
	manager.onPointerEnter(props.expr)
}

function onUnhoverLabel() {
	labelHovered.value = false
	manager.onPointerLeave()
}

// NOTE: 140 shouldn't be a magic number
const rowKeyWidth = inject('Row__key_width', ref(140))

const indent = useCssVar('--ui-inspector-tree-icon-size')

provide(
	'Row__key_width',
	computed(() => rowKeyWidth.value - parseFloat(indent.value))
)
</script>

<template>
	<div
		class="Row"
		:class="{expanded, hovered}"
		:style="{'--ui-inspector-label-width': rowKeyWidth + 'px'}"
	>
		<div
			class="key"
			@pointerenter="onHoverLabel"
			@pointerleave="onUnhoverLabel"
		>
			<button
				class="icon material-symbols-rounded"
				:class="{expandable}"
				@click="onClickChevron"
			>
				{{ expandable ? 'chevron_right' : '・' }}
			</button>
			<div v-if="$slots.label" class="label">
				<slot name="label" />
			</div>
		</div>
		<component
			:is="collapsedExprComponent"
			:expr="expr"
			:expectedType="expectedType"
			:hovered="hovered"
			layout="collapsed"
			@update:hovered="exprHovered = $event"
			@update:expr="$emit('update:expr', $event)"
			@confirm="$emit('confirm')"
			@cancel="$emit('cancel')"
		/>
		<Expr
			v-if="expanded"
			class="detail"
			:expr="expr"
			:hovered="hovered"
			@update:hovered="exprHovered = $event"
			@update:expr="$emit('update:expr', $event)"
			@confirm="$emit('confirm')"
			@cancel="$emit('cancel')"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.Row
	display grid
	grid-template-columns var(--ui-inspector-label-width) 1fr
	gap var(--ui-input-row-margin) 0
	--color-chevron var(--color-outline)

	&.expanded
		& > .key > .icon
			transform rotate(90deg)

	&.hovered > .key > .icon
		color var(--color-primary)
.key
	user-select none
	display flex
	align-items center
	font-size var(--ui-input-font-size)
	height var(--ui-input-height)
.icon
	// background red
	font-size var(--ui-inspector-tree-icon-size)
	width var(--ui-inspector-tree-icon-size)
	height var(--ui-inspector-tree-icon-size)
	input-transition(transform, color)
	color var(--color-chevron)

	&:not(.expandable)
		cursor initial
		transform none !important

.label
	width var(--ui-inspector-header-width)
	line-height var(--ui-input-height)
	padding-left .2em

.detail
	grid-column 1 / span 2
</style>

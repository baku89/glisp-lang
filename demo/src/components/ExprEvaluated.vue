<script setup lang="ts">
import * as G from 'glisp'
import {computed} from 'vue'

import {useExpr, useExprEvaluated} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import ValueNumber from './ValueNumber.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Expr
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		hovered: false,
		expectedType: () => G.all,
	}
)

const emits = defineEmits<{
	(e: 'update:hovered', hovered: boolean): void
}>()

const {exprRef, typeInvalid} = useExpr(props)
const evaluated = useExprEvaluated(exprRef)
const manager = useGlispManager()

const isNumber = computed(() => G.NumberType.isTypeFor(evaluated.value))

function onHoverChange(hovered: boolean) {
	if (hovered) {
		manager.onPointerEnter(props.expr)
	} else {
		manager.onPointerLeave()
	}
	emits('update:hovered', hovered)
}
</script>

<template>
	<ValueNumber
		v-if="isNumber"
		:hovered="hovered"
		:invalid="typeInvalid"
		:value="(evaluated as G.Number)"
		@update:hovered="onHoverChange($event)"
	/>
	<div
		v-else
		class="ExprEvalauted"
		:class="{typeInvalid, hovered}"
		@pointerenter="onHoverChange(true)"
		@pointerleave="onHoverChange(false)"
	>
		{{ evaluated.print() }}
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprEvalauted
	--color-border var(--color-surface-border)

	display block
	font-size var(--ui-input-font-size)
	width 100%
	height var(--ui-input-height)
	line-height @height
	border-radius var(--ui-input-border-radius)
	padding 0 var(--ui-input-horiz-padding)
	font-family var(--font-code)
	cursor inherit
	white-space nowrap
	overflow hidden
	text-overflow ellipsis
	input-transition(box-shadow)
	box-shadow 0 0 0 1px inset var(--color-border)

	&:hover, &.hovered
		--color-border var(--color-primary)
	&.typeInvalid
		color var(--color-error)
		--color-border var(--color-error)
</style>

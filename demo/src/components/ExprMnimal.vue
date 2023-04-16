<script setup lang="ts">
import * as G from 'glisp'
import {computed, watchEffect} from 'vue'

import {useExpr, useExprEvaluated} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'

const props = withDefaults(
	defineProps<{
		expr: G.Expr
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		expectedType: () => G.all,
		hovered: false,
	}
)

const {exprRef} = useExpr(props)
const evaluated = useExprEvaluated(exprRef)
const evaluatedStr = computed(() => evaluated.value.print())

function updateEvaluated() {
	evaluated.value = props.expr.eval()
}

watchEffect(() => {
	props.expr.on('change', updateEvaluated)
	updateEvaluated()
})

const invalidType = computed(() => {
	return !props.expectedType.isTypeFor(evaluated.value)
})

const manager = useGlispManager()
</script>

<template>
	<div
		class="ExprMinimal"
		:class="{invalidType, hovered}"
		@mouseenter="manager.onPointerEnter(expr)"
		@mouseleave="manager.onPointerLeave()"
	>
		{{ evaluatedStr }}
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprMinimal
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
	&.invalidType
		color var(--color-error)
		--color-border var(--color-error)
</style>

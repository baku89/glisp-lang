<script setup lang="ts">
import * as G from 'glisp'
import {computed, watchEffect} from 'vue'

import {useExpr, useExprEvaluated} from '../use/useExpr'

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
</script>

<template>
	<div class="ExprMinimal" :class="{invalidType}">
		{{ evaluatedStr }}
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprMinimal
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
	--border-color var(--color-surface-border)
	box-shadow 0 0 0 1px inset var(--border-color)

	&.invalidType
		color var(--color-error)
		--border-color var(--color-error)
</style>

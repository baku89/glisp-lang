<script setup lang="ts">
import * as G from 'glisp'
import {ref, watchEffect} from 'vue'

interface Props {
	expr: G.Expr
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})

const evaluated = ref('')

function updateEvaluated() {
	evaluated.value = props.expr.eval().print()
}
updateEvaluated()

watchEffect(() => {
	props.expr.on('change', updateEvaluated)
})
</script>

<template>
	<div class="ExprMinimal">{{ evaluated }}</div>
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
	background var(--color-primary-container)
	color var(--color-on-primary-container)
	padding 0 var(--ui-input-horiz-padding)
	font-family var(--font-code)
	cursor inherit
	white-space nowrap
	overflow hidden
	text-overflow ellipsis
</style>

<script setup lang="ts">
import * as G from 'glisp'

interface Props {
	expr: G.Expr
	valueType?: G.Value
}

withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})
</script>

<template>
	<div class="ExprMinimal">{{ expr.eval().value.print() }}</div>
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
</style>

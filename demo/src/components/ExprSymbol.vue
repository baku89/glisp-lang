<script setup lang="ts">
import * as G from 'glisp'

interface Props {
	expr: G.Symbol
	valueType?: G.Value
}

withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})
</script>

<template>
	<div class="ExprSymbol">
		<input type="text" :value="expr.print()" />
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprSymbol
	font-family var(--font-code)

input
	display block
	font-size var(--ui-input-font-size)
	width 100%
	height var(--ui-input-height)
	border-radius var(--ui-input-border-radius)
	background var(--color-surface-variant)
	color var(--color-on-surface-variant)
	padding 0 var(--ui-input-horiz-padding)

	&:active, &:focus
		outline 2px solid var(--color-primary)
</style>

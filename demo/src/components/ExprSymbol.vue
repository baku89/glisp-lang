<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref} from 'vue'

import InputString from './InputString.vue'

interface Props {
	expr: G.Symbol
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})

const emits = defineEmits<{
	(e: 'update:expr', newExpr: G.Expr): void
}>()

const symbolName = ref(props.expr.print())

const isSymbolNameInvalid = computed(() => {
	const ret = G.Parser.Symbol.parse(symbolName.value)
	return ret.status === false
})

function onInput(value: string) {
	const newExpr = G.Parser.Symbol.tryParse(value)
	emits('update:expr', newExpr)
}
</script>

<template>
	<div class="ExprSymbol">
		<span class="arrow-icon material-symbols-rounded"> reply </span>
		<InputString
			:modelValue="symbolName"
			:invalid="isSymbolNameInvalid"
			@update:modelValue="onInput"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprSymbol
	text-align center
	position relative

	.arrow-icon
		display block
		top 0
		position absolute
		left 0
		height 100%
		aspect-ratio 1
		line-height var(--ui-input-height)
		font-size 1em
		border-radius var(--ui-input-border-radius)
		z-index 20

		&:hover
			background var(--color-primary)
			color var(--color-on-primary)
			cursor pointer
</style>

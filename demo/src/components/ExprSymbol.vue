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
	<InputString
		:modelValue="symbolName"
		class="ExprSymbol"
		:invalid="isSymbolNameInvalid"
		@update:modelValue="onInput"
	/>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprSymbol
	text-align center
</style>

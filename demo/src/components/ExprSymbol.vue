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

const symbolName = ref(props.expr.print())

const isSymbolNameInvalid = computed(() => {
	const ret = G.Parser.Symbol.parse(symbolName.value)
	return ret.status === false
})
</script>

<template>
	<InputString
		v-model="symbolName"
		class="ExprSymbol"
		:invalid="isSymbolNameInvalid"
	/>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprSymbol
	text-align right
</style>

<script setup lang="ts">
import * as G from 'glisp'

import InputString from './InputString.vue'

interface Props {
	expr: G.Symbol
	valueType?: G.Value
}

withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})
</script>

<template>
	<InputString class="ExprSymbol" :modelValue="expr.print()" />
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
</style>

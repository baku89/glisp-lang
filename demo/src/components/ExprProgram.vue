<script setup lang="ts">
import * as G from 'glisp'

import Expr from './ExprAll.vue'

interface Props {
	expr: G.Program
	valueType?: G.Value
}

withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})
</script>

<template>
	<div class="ExprProgram">
		<Expr v-if="expr.expr" :expr="expr.expr" :value-type="valueType" />
		<div v-else class="empty">{{ expr.print() }}</div>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.empty
	font-family var(--font-code)
</style>

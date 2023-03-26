<script setup lang="ts">
import * as G from 'glisp'
import {computed} from 'vue'

import Surface from './Surface.vue'

interface Props {
	expr: G.Expr
}

const props = defineProps<Props>()

const printed = computed(() => {
	return props.expr.print()
})
</script>

<template>
	<Surface class="ExprInspector">
		<pre><code>{{ printed }}</code></pre>
	</Surface>
</template>

<style lang="stylus" scoped>

.ExprInspector
	padding 1rem
</style>

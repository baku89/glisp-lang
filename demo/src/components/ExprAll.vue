<script setup lang="ts">
import * as G from 'glisp'
import {computed} from 'vue'

import ExprApp from './ExprApp.vue'
import ExprLiteral from './ExprLiteral.vue'
import ExprProgram from './ExprProgram.vue'
import ExprScope from './ExprScope.vue'
import ExprSymbol from './ExprSymbol.vue'
import ExprVecLiteral from './ExprVecLiteral.vue'

interface Props {
	expr: G.Expr
	valueType?: G.Value
	layout?: 'expanded' | 'collapsed' | 'minimal'
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
	layout: 'expanded',
})

const exprComponent = computed(() => {
	switch (props.expr.type) {
		case 'Program':
			return ExprProgram
		case 'Literal':
			return ExprLiteral
		case 'Symbol':
			return ExprSymbol
		case 'App':
			return ExprApp
		case 'Scope':
			return ExprScope
		case 'VecLiteral':
			return ExprVecLiteral
		default:
			return null
	}
})
</script>

<template>
	<component
		:is="exprComponent"
		v-if="exprComponent !== null"
		:expr="expr"
		:value-type="valueType"
		:layout="layout"
		v-bind="$attrs"
	/>
	<div v-else class="text">
		{{ expr.print() }} -> {{ expr.eval().value.print() }}
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
.text
	border-radius var(--ui-input-border-radius)
	font-family var(--font-code)
	color var(--color-on-surface-variant)
	background var(--color-surface-variant)
	font-size var(--ui-input-font-size)
	padding 0 var(--ui-input-horiz-padding)

	&:active, &:focus
		outline 2px var(--color-primary) solid
</style>

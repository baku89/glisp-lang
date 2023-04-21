<script setup lang="ts">
import * as G from 'glisp'
import {computed} from 'vue'

import {useExpr, useExprEvaluated} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import ExprApp from './ExprApp.vue'
import ExprDictLiteral from './ExprDictLiteral.vue'
import ExprEvaluated from './ExprEvaluated.vue'
import ExprLiteral from './ExprLiteral.vue'
import ExprProgram from './ExprProgram.vue'
import ExprScope from './ExprScope.vue'
import ExprSymbol from './ExprSymbol.vue'
import ExprVecLiteral from './ExprVecLiteral.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Expr
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		expectedType: () => G.all,
		layout: 'expanded',
	}
)

const {exprRef} = useExpr(props)
const evaluated = useExprEvaluated(exprRef)

defineEmits<{
	(e: 'update:expr', expr: G.Expr): void
	(e: 'confirm'): void
	(e: 'update:hovered', hovered: boolean): void
}>()

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
		case 'DictLiteral':
			return ExprDictLiteral
		default:
			return ExprEvaluated
	}
})

const manager = useGlispManager()

const referrable = computed(() => {
	return evaluated.value.isSubtypeOf(manager.symbolType.value)
})
</script>

<template>
	<component
		:is="exprComponent"
		:expr="expr"
		:expectedType="expectedType"
		:referrable="referrable"
		:hovered="hovered"
		v-bind="$attrs"
		@update:expr="$emit('update:expr', $event)"
		@update:hovered="$emit('update:hovered', $event)"
		@confirm="$emit('confirm')"
		@pointerenter="manager.onPointerEnter(expr)"
		@pointerleave="manager.onPointerLeave()"
	/>
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

<script setup lang="ts">
import * as G from 'glisp'
import {computed} from 'vue'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import InputNumber from './InputNumber.vue'
import InputString from './InputString.vue'

interface Props {
	expr: G.Literal
	expectedType?: G.Value
	hovered?: boolean
	invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	expectedType: () => G.all,
	hovered: false,
	invalid: false,
})

const emits = defineEmits<{
	(e: 'update:expr', newExpr: G.Expr): void
	(e: 'confirm'): void
	(e: 'update:hovered', hovered: boolean): void
}>()

const {exprRef} = useExpr(props)

const value = computed(() => exprRef.value.value)

const inputComponent = computed(() => {
	switch (typeof value.value) {
		case 'string':
			return InputString
		default:
			return InputNumber
	}
})

function onInput(newValue: number | string) {
	const newExpr = G.literal(newValue)
	emits('update:expr', newExpr)
}

const manager = useGlispManager()

function onHover() {
	emits('update:hovered', true)
	manager.onPointerEnter(props.expr)
}

function onUnhover() {
	emits('update:hovered', false)
	manager.onPointerLeave()
}
</script>

<template>
	<div class="ExprLiteral" :class="{number: typeof value === 'number'}">
		<component
			:is="inputComponent"
			:modelValue="value"
			:hovered="hovered"
			:invalid="invalid"
			@update:modelValue="onInput"
			@confirm="$emit('confirm')"
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
.ExprLiteral
	display grid
	grid-template-columns 1fr
	gap var(--ui-input-gap)
	&.number
		grid-template-columns repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
</style>

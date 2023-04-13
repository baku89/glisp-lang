<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref, watchEffect} from 'vue'

import {useGlispManager} from '../use/useGlispManager'
import InputNumber from './InputNumber.vue'
import InputString from './InputString.vue'

interface Props {
	expr: G.Literal
	expectedType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	expectedType: () => G.all,
})

const emits = defineEmits<{
	(e: 'update:expr', newExpr: G.Expr): void
	(e: 'confirm'): void
}>()

const value = ref(props.expr.value)

watchEffect(() => {
	value.value = props.expr.value
})

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

	value.value = newValue
}

const manager = useGlispManager()
</script>

<template>
	<div class="ExprLiteral">
		<component
			:is="inputComponent"
			:modelValue="value"
			@update:modelValue="onInput"
			@confirm="$emit('confirm')"
			@pointerenter="manager.onPointerEnter(expr)"
			@pointerleave="manager.onPointerLeave()"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
.ExprLiteral
	display grid
	grid-template-columns repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
	gap var(--ui-input-gap)
</style>

<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref, watchEffect} from 'vue'

import InputNumber from './InputNumber.vue'
import InputString from './InputString.vue'

interface Props {
	expr: G.Literal
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
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
</script>

<template>
	<component
		:is="inputComponent"
		:modelValue="value"
		class="ExprLiteral"
		@update:modelValue="onInput"
		@confirm="$emit('confirm')"
	/>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
</style>

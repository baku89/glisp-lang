<script setup lang="ts">
import * as G from 'glisp'

import InputNumber from './InputNumber.vue'

interface Props {
	value: G.Number
	hovered?: boolean
	invalid?: boolean
}

withDefaults(defineProps<Props>(), {
	expectedType: () => G.all,
	hovered: false,
	invalid: false,
})

const emits = defineEmits<{
	(e: 'update:hovered', hovered: boolean): void
}>()

function onHover() {
	emits('update:hovered', true)
}

function onUnhover() {
	emits('update:hovered', false)
}
</script>

<template>
	<div class="ValueNumber">
		<InputNumber
			:modelValue="value.value"
			:hovered="hovered"
			:invalid="invalid"
			disabled
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
.ValueNumber
	display grid
	grid-template-columns repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
	gap var(--ui-input-gap)
</style>

<script lang="ts" setup>
withDefaults(
	defineProps<{
		modelValue: string
		disabled?: boolean
		invalid?: boolean
	}>(),
	{
		disabled: false,
		invalid: false,
	}
)

const emits = defineEmits<{
	(e: 'update:modelValue', value: string): void
	(e: 'confirm'): void
}>()

let hasChanged = false
function onFocus() {
	hasChanged = false
}

function onInput(e: Event) {
	hasChanged = true
	const newValue = (e.target as HTMLInputElement).value
	emits('update:modelValue', newValue)
}

function onBlur() {
	if (!hasChanged) return
	emits('confirm')
}
</script>

<template>
	<div class="InputString" :class="{invalid}">
		<input
			class="input"
			type="text"
			:value="modelValue"
			:disabled="disabled"
			@focus="onFocus"
			@input="onInput"
			@blur="onBlur"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.InputString
	input()
</style>

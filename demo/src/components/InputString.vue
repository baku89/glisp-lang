<template>
	<div class="InputString" :class="{invalid}">
		<input
			class="InputString__input"
			type="text"
			:value="modelValue"
			:disabled="disabled"
			@focus="onFocus"
			@input="onInput"
		/>
	</div>
</template>

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
}>()

function onFocus(e: Event) {
	;(e.target as HTMLInputElement).select()
}

function onInput(e: Event) {
	const newValue = (e.target as HTMLInputElement).value
	emits('update:modelValue', newValue)
}
</script>

<style lang="stylus" scoped>
@import '@/common.styl'

.InputString
	input()
</style>

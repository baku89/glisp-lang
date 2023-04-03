<template>
	<div class="InputString" :class="{invalid}">
		<input
			class="input"
			type="text"
			:value="modelValue"
			:disabled="disabled"
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

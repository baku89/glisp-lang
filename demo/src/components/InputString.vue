<script lang="ts" setup>
import {ref} from 'vue'

withDefaults(
	defineProps<{
		modelValue: string
		disabled?: boolean
		invalid?: boolean
		tweaked?: boolean
	}>(),
	{
		disabled: false,
		invalid: false,
		tweaked: false,
	}
)

const inputEl = ref<HTMLInputElement | null>(null)

const emits = defineEmits<{
	(e: 'update:modelValue', value: string): void
	(e: 'confirm'): void
	(e: 'blur'): void
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
	if (hasChanged) {
		emits('confirm')
	}
	emits('blur')
}

defineExpose({
	focus() {
		inputEl.value?.focus()
		inputEl.value?.select()
	},
})
</script>

<template>
	<div class="InputString" :class="{invalid, tweaked}">
		<input
			ref="inputEl"
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
	input('.tweaked')
</style>

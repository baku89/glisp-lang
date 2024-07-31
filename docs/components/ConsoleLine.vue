<script lang="ts" setup>
import {Ast, print} from '@glisp/lang'
import {computed} from 'vue'

const props = defineProps<{
	input: Ast
	ret: Ast
}>()

const inputCode = computed(() => print(props.input))

const retCode = computed(() => print(props.ret))
</script>

<template>
	<div class="ConsoleLine">
		<div class="input"><span class="chevron">&gt;</span>{{ inputCode }}</div>
		<div class="ret">{{ retCode }}</div>
	</div>
</template>

<style lang="stylus" scoped>
.ConsoleLine
	font-family var(--font-family-code)

.chevron
	font-weight bold
	margin-right .5em
</style>

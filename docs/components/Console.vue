<script lang="ts" setup>
import {ref} from 'vue'
import {Ast, list, s, evaluate, parse, Log, getLogs} from '@glisp/lang'
import ConsoleLine from './ConsoleLine.vue'

const $input = ref<HTMLInputElement | null>(null)

const inputStr = ref('')

interface Line {
	input: Ast
	ret: Ast
	logs?: Log[]
}

const lines = ref<Line[]>([
	{
		input: list(s`+`, 1, 2),
		ret: 3,
	},
])

function evaluateLine() {
	const str = inputStr.value

	try {
		const input = parse(str)
		const ret = evaluate(input)

		const logs = getLogs(input)

		lines.value.push({input, ret, logs})
	} catch (e) {
		console.error(e)
	}

	inputStr.value = ''
}
</script>

<template>
	<div class="Console">
		<div class="lines">
			<ConsoleLine
				class="line"
				v-for="line in lines"
				:input="line.input"
				:ret="line.ret"
			/>
		</div>
		<div class="input-line" ref="$input">
			<span class="chevron">&gt;</span>
			<input class="input" v-model="inputStr" @keydown.enter="evaluateLine" />
		</div>
	</div>
</template>

<style lang="stylus" scoped>

.Console
	height 100%
	overflow-y scroll

.line
	margin-bottom 1rem

.input-line
	display flex

.chevron
	font-family var(--font-family-code)1
	font-weight bold
	margin-right .5em

.input
	font-family var(--font-family-code)
	font-size 1rem
	appearance none
	border none
	padding 0
	outline none
	width 100%
</style>

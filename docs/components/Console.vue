<script lang="ts" setup>
import {ref, shallowRef} from 'vue'
import {
	Ast,
	list,
	s,
	evaluate,
	parse,
	Log,
	getLogs,
	Env,
	unit,
} from '@glisp/lang'
import ConsoleLine from './ConsoleLine.vue'

const props = defineProps<{
	env: Env
}>()

const $input = ref<HTMLInputElement | null>(null)

const inputStr = ref('')

interface Line {
	input: Ast
	ret: Ast
	logs?: Log[]
}

const lines = shallowRef<Line[]>([
	{
		input: list(s`+`, 1, 2),
		ret: 3,
	},
])

function evaluateLine() {
	const str = inputStr.value

	try {
		const input = parse(str)
		console.log(props.env)
		const ret = evaluate(input, props.env)
		const logs = getLogs(input)

		lines.value.push({input, ret, logs})
	} catch (e) {
		lines.value.push({
			input: unit,
			ret: unit,
			logs: [
				{
					level: 'error',
					reason: [['string', 'Parse error']],
				},
			],
		})
	}

	inputStr.value = ''
}
</script>

<template>
	<div class="Console">
		<div class="lines">
			<ConsoleLine class="line" v-for="line in lines" v-bind="line" />
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
	font-size inherit
	letter-spacing inherit
	appearance none
	border none
	padding 0
	outline none
	width 100%
</style>

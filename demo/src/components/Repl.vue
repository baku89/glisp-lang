<script setup lang="ts">
import {ref, computed} from 'vue'

import * as G from '../../..'

const input = ref('')
const inputLines = computed(() => input.value.split('\n').length)

const parsed = computed(() => G.parse(input.value, replScope))

const inputIcon = computed(() => {
	if (!parsed.value.status) return 'dangerous'
	if (!parsed.value.value.expr) return 'brightness_empty'
	return 'done'
})

const inputClass = computed(() => {
	if (!parsed.value.status) return 'error'
	if (parsed.value.value.expr) return 'parsed'
	return ''
})

interface Result {
	input: string
	evaluated: string
	log: {
		icon: string
		reason: G.Log['reason']
		ref: string
	}[]
}

const results = ref<Result[]>([])

const IO = G.primType('IO', () => {
	return
})

const replScope = G.PreludeScope.extend({
	IO: G.valueContainer(IO),
	def: G.valueContainer(
		G.fn(
			G.fnType({name: G.StringType, value: G.all}, IO),
			(name: G.Arg<G.String>, value: G.Arg<G.Value>) =>
				G.withLog(
					IO.of(() => {
						replScope.items[name().value] = G.valueContainer(value())
					})
				)
		)
	),
	clear: G.valueContainer(IO.of(clear)),
})

function evaluate() {
	if (!parsed.value.status) return

	const expr = parsed.value.value

	const [evaluated, log] = expr.eval().asTuple

	results.value.push({
		input: expr.print(),
		evaluated: evaluated.print(),
		log: Array.from(log).map(({level, reason, ref}) => {
			return {
				icon: level === 'warn' ? 'warning' : level,
				reason,
				ref: ref.print(),
			}
		}),
	})

	// Execute the content of IO monad
	if (IO.isTypeFor(evaluated)) {
		evaluated.value()
	}

	input.value = ''
}

function clear() {
	results.value = []
}
</script>

<template>
	<div class="Repl">
		<ul class="results">
			<li class="result" v-for="{input, evaluated, log} in results">
				<div class="input">{{ input }}</div>
				<ul class="log">
					<li v-for="{icon, reason, ref} in log">
						<span class="log__icon material-symbols-rounded" :class="icon">
							{{ icon }}
						</span>
						<div class="log__reason">{{ reason }}</div>
						<div class="log__ref">at {{ ref }}</div>
					</li>
				</ul>
				<div class="evaluated">{{ evaluated }}</div>
			</li>
		</ul>

		<div
			class="input-form"
			:class="inputClass"
			:style="{height: inputLines * 1.6 + 1 + 'em'}"
		>
			<textarea
				data-gramm="false"
				data-gramm_editor="false"
				data-enable-grammarly="false"
				type="text"
				v-model="input"
				@keydown.meta.enter.prevent="evaluate"
			/>
			<button
				class="run"
				:style="{borderTopLeftRadius: inputLines <= 1 ? '0px' : ''}"
				@click="evaluate"
			>
				<span class="material-symbols-rounded">{{ inputIcon }}</span>
			</button>
		</div>
	</div>
</template>

<style lang="stylus">
@import '../common.styl'

$padding-right = 5rem
$indent = 2rem

.Repl
	margin-top 2rem
	padding-bottom 10vh

.results
	font-family var(--font-code)
	line-height 1.6

	.result:not(:first-child)
		padding-top -1px
		border-top 1px solid black

	.input, .evaluated
		position relative
		padding 0.5rem $padding-right 0 $indent

		&:before
			position absolute
			left .7rem
			font-weight 1000
			color #bbb

	.input:before
		content: '>'

	.evaluated:before
		content: '<'

	.evaluated
		padding-bottom .5rem

.log
	li
		position relative
		padding-left $indent

	&__icon
		position absolute
		left 0.2rem
		transform scale(.8) translateY(-10%)

		&.error
			color var(--color-error)

		&.warning
			color var(--color-warning)


	&__ref
		color #bbb

.input-form
	--outline var(--color-on-background)
	--icon var(--color-background)

	&.error
		--outline var(--color-error)
		--icon var(--color-on-error)

	&.parsed
		--outline var(--color-primary)
		--icon var(--color-on-primary)

	&.error, &.parsed
		&:before
			color var(--outline)

	width 100%
	border-radius 1rem
	outline var(--outline) solid 1px
	position relative
	overflow hidden
	transition outline .2s ease
	padding 0.5rem $padding-right 0.5rem $indent
	font-family var(--font-code)

	&:before
		content: '>'
		position absolute
		left .7rem
		font-weight 600
		color #bbb

	textarea
		width 100%
		height 100%
		resize none
		line-height 1.6
		outline none
		overflow hidden

.run
	position absolute
	right 0
	bottom 0
	font-family var(--font-heading)
	font-weight 600
	width 4rem
	height 2.6em
	background var(--outline)
	color var(--icon)
	text-align center
	border-top-left-radius 2rem
	transition border-top-left-radius .3s ease, background .2s ease, color .2s ease

	span
		font-size 1.6rem
		line-height 1.7em
</style>

<script setup lang="ts">
import {useMagicKeys} from '@vueuse/core'
import * as G from 'glisp'
import {computed, nextTick, ref} from 'vue'

import {IO, projectScope, replScope} from '../ProjectScope'
import {useGlispUndoRedo} from '../use/useGlispUndoRedo'
import ExprScope from './ExprScope.vue'
import Surface from './Surface.vue'

const input = ref('')
const inputLines = computed(() => input.value.split('\n').length)

const parsed = computed(() => G.parse(input.value, projectScope as G.Scope))

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

interface ReplLine {
	key: number
	input: string
	evaluated: string
	log: {
		key: number
		icon: string
		reason: G.Log['reason']
		ref?: string
	}[]
}

const replLines = ref<ReplLine[]>([])

const appEl = document.getElementById('app') as HTMLElement

function evaluate() {
	if (!parsed.value.status) return

	const expr = parsed.value.value

	let result: G.Value

	try {
		result = expr.eval()
		window.result = result
	} catch (err) {
		result = G.unit.withLog({
			level: 'error',
			reason: err instanceof Error ? err.message : 'Run-time error',
			ref: err instanceof G.EvalError ? err.ref : expr,
		})
	}

	let printed = ''
	if (!IO.isTypeFor(result)) {
		printed = result.print()
	}

	replLines.value.push({
		key: replLines.value.length,
		input: expr.print(),
		evaluated: printed,
		log: Array.from(result.log).map(({level, reason, ref}, key) => {
			reason = reason.replaceAll(/`(.+?)`/g, '<code>$1</code>')

			return {
				key,
				icon: level === 'warn' ? 'warning' : level,
				reason,
				ref: ref?.print(),
			}
		}),
	})

	// Execute the content of IO monad
	if (IO.isTypeFor(result)) {
		result.value()
	}

	nextTick(() => {
		appEl.scrollTop = appEl.scrollHeight + 1000
	})

	input.value = ''
}

replScope.set('clear!', G.container(IO.of(() => (replLines.value = []))))

const printed = ref(projectScope.print())
function updatePrinted() {
	printed.value = projectScope.print()
}
projectScope.on('edit', updatePrinted)

const evaluated = ref(projectScope.eval().print())

function updateEvaluated() {
	evaluated.value = projectScope.eval().print()
}

projectScope.on('change', updateEvaluated)

const {undo} = useGlispUndoRedo()

useMagicKeys({
	passive: false,
	onEventFired(e) {
		if (e.metaKey && e.key === 'z' && e.type === 'keydown') {
			e.preventDefault()
			undo()
		}
	},
})
</script>

<template>
	<div class="Repl">
		<Surface class="rawCode">
			<pre><code>{{ printed }}</code></pre>
			<pre><code>--> {{ evaluated }}</code></pre>
		</Surface>
		<ExprScope class="projectScope" :expr="projectScope" />
		<ul class="results">
			<li
				v-for="{input, evaluated, log, key} in replLines"
				:key="key"
				class="result"
			>
				<div class="input">{{ input }}</div>
				<ul class="log">
					<li v-for="{icon, reason, ref, key} in log" :key="key">
						<span class="log__icon material-symbols-rounded" :class="icon">
							{{ icon }}
						</span>
						<div class="log__reason" v-html="reason" />
						<div v-if="ref" class="log__ref">
							at <code>{{ ref }}</code>
						</div>
					</li>
				</ul>
				<div v-if="evaluated" class="evaluated">{{ evaluated }}</div>
			</li>
		</ul>

		<div
			class="input-form"
			:class="inputClass"
			:style="{height: inputLines * 1.6 + 1 + 'em'}"
		>
			<textarea
				v-model="input"
				data-gramm="false"
				data-gramm_editor="false"
				data-enable-grammarly="false"
				type="text"
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
@import '@/common.styl'

$padding-right = 5rem
$indent = 2rem

.Repl
	margin-top 2rem
	padding-bottom 10vh

.rawCode
	padding 1rem
	margin-bottom 2rem

	pre, code
		display block
		width 100%
		margin-top 0

.projectScope
	margin-bottom 2rem

.results
	font-family var(--font-code)
	line-height 1.6

.result
	padding 0.5rem 0
	&:not(:first-child)
		padding-top -1px
		border-top 1px solid black

.input, .evaluated
	white-space pre-wrap
	position relative
	padding 0 $padding-right 0 $indent

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

	&__reason
		font-family var(--font-ui)

		code
			padding 0 0.2rem
			border-radius .3em
			font-size 1rem
			background #eee
			color var(--color-on-surface)


	&__ref
		color #bbb
		font-family var(--font-ui)
		text-indent 2em

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

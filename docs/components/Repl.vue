<script lang="ts" setup>
import {Ast, Key, PreludeEnv, print, scope} from '@glisp/lang'
import {computed, ref, shallowRef} from 'vue'
import Console from './Console.vue'

const ast = shallowRef(scope({a: 1, b: 2}))

const pwd = ref<Key[]>([])

const env = computed(() => {
	return PreludeEnv.pushed(ast.value)
})

const code = computed(() => {
	return print(ast.value)
})
</script>

<template>
	<ClientOnly>
		<div class="Repl">
			<div class="pane">
				<div class="title">Code</div>

				<div class="Code">
					{{ code }}
				</div>
			</div>
			<div class="pane">
				<div class="title">Console</div>
				<div class="console-wrapper">
					<Console :env="env" />
				</div>
			</div>
		</div>
	</ClientOnly>
</template>

<style lang="stylus">
.Repl
	position relative
	display grid
	grid-template-columns 1fr 1fr
	gap 1rem
	font-size .89em

.pane
	height 85%
	display grid
	grid-template-rows auto 1fr
	gap .8rem
	padding .4rem 1rem 1rem
	border 1px solid black
	border-radius 0.5rem
.Code
	font-family var(--font-family-code)
	letter-spacing -0.03em

.title
	font-family var(--font-family-code)
	font-weight 600
	font-size 1rem
	text-align center
	letter-spacing -0.03em

.console-wrapper
	height 100%
	overflow-y scroll
	letter-spacing -0.03em
</style>

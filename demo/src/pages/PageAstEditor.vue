<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref} from 'vue'

import Icon from '../components/Icon.vue'
import Surface from '../components/Surface.vue'

const typeStr = ref('Number')

const typeValue = computed(() => {
	const ret = G.parse(typeStr.value)
	if (!ret.status) return null
	return ret.value.eval()
})

const defaultExpr = computed(() => {
	if (typeValue.value === null) return null
	return typeValue.value.defaultValue.toExpr()
})
</script>

<template>
	<div>
		<Surface class="gheader" align="top-left">
			<Icon class="glisp-logo" src="assets/favicon/favicon.svg" />
			<ul>
				<li><a href="https://github.com/sponsors/baku89">Repl</a></li>
				<li><a href="https://github.com/sponsors/baku89">Ast</a></li>
			</ul>
		</Surface>
		<main class="entry">
			<h1>Glisp / AST Editor</h1>
			<hr />
			<p>
				Strongly-typed language is more suitable in visual programming
				environment because type information can be used as a hint for
				dispalying appropriate GUIs corresponding to the context of expressions.
			</p>
			<h2>Type</h2>
			<input v-model="typeStr" type="text" />
			<div>{{ typeValue?.print() }}</div>
			<div>{{ defaultExpr?.print() }}</div>
		</main>
	</div>
</template>

<style scoped lang="stylus">
@import '@/common.styl'
.gheader
	user-select none
	position fixed
	top 0
	left 0
	height 3rem
	display flex
	padding 0 2rem 0 1rem
	align-items center
	gap 2rem
	backdrop-filter blur(12px)
	z-index 1000

	ul
		font-size 1rem
		display flex
		gap 2rem

		li
			font-family var(--font-heading)
			weird-heading()
			font-weight 500

.glisp-logo
	width 1.2rem

.entry
	max-width 50rem
</style>

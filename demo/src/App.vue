<script setup lang="ts">
import {ref} from 'vue'
import {parse} from '../..'

const result = ref(
	parse('[(++ "Hello" " (+) " "World!") (+ 3.2 2)]').eval().result.print()
)

const inputs = ref()

defineExpose({
	result,
})
</script>

<template>
	<header class="gheader"></header>
	<main>
		<h1>Glisp / REPL</h1>
		<hr />
		<p>
			<a href="https://scrapbox.io/glisp/Glisp_v2:_Documentation"
				>Language Specification</a
			>
			(in 🇯🇵)
		</p>
		<p>
			<em>Glisp</em> (/dʒiːlisp/ /glisp/) is a Lisp-based design environment
			that introduces the approach of computational arts to the world of
			repetitive and manual design. Mainly developed by Baku Hashimoto (橋本麦).
		</p>
		<code class="repl">{{ result }}</code>
	</main>
</template>

<style scoped lang="stylus">

.gheader
	position absolute
	top 0
	left -1px
	right -1px
	border-color var(--color-on-surface)
	border-width 0 1px 1px 1px
	background var(--color-surface)
	height 3rem
	border-radius 0 0 1em 1.5em

main
	max-width 50rem
.repl
	display block
	padding 1em
	border-radius 1em
	border 1px solid var(--color-on-surface)
	background var(--color-surface)
	color var(--color-on-surface)
</style>

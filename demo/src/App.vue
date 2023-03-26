<script setup lang="ts">
import Icon from './components/Icon.vue'
import Repl from './components/Repl.vue'
import Surface from './components/Surface.vue'
</script>

<template>
	<div>
		<Surface class="gheader" align="top">
			<Icon class="glisp-logo" src="assets/favicon/favicon.svg" />
			<ul>
				<li><a href="https://glisp.app">Try</a></li>
				<li><a href="https://scrapbox.io/glisp/">Doc</a></li>
				<li><a href="https://github.com/baku89/glisp-lang">Repo</a></li>
				<li><a href="https://github.com/sponsors/baku89">Support</a></li>
			</ul>
		</Surface>
		<main class="entry">
			<h1>Glisp / REPL</h1>
			<hr />
			<p>
				<a href="https://scrapbox.io/glisp/Glisp_v2:_Documentation"
					>Language Specification</a
				>
				(in 🇯🇵)
			</p>
			<p>
				<em>Glisp</em> (/dʒiːlɪsp/ /gɫɪsp/) is a Lisp-based design tool that
				bridges the gap between parametric methodologies and traditional design
				techniques, empowering artists to explore new forms of expression.
				Mainly developed by Baku Hashimoto (橋本麦).
			</p>
			<Repl />
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
	right 0
	height 3rem
	display flex
	padding 0 2rem 0 1rem
	align-items center
	gap 2rem
	backdrop-filter blur(12px)
	z-index 1000

	ul
		font-size 1.2rem
		display flex
		gap 2rem

		li
			font-family var(--font-heading)
			weird-heading()
			font-weight 500

.glisp-logo
	width 1.8rem

.entry
	max-width 50rem
</style>

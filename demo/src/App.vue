<script setup lang="ts">
import {ref} from 'vue'

import {tryParse} from '../..'
import Icon from './components/Icon.vue'
import Repl from './components/Repl.vue'

const result = ref(
	tryParse(
		`; Examples
(let circle: (=> [c: Vec2 r:Number] (ellipse c [r r]))
     c1: (circle [0 ./0] 100)
     c2: (circle c1/c c1/r)
     (style (stroke "black")
       c1 c2))`
	).print()
)

defineExpose({
	result,
})
</script>

<template>
	<div>
		<header class="gheader">
			<Icon class="glisp-logo" src="assets/favicon/favicon.svg" />
			<ul>
				<li><a href="https://glisp.app">Try</a></li>
				<li><a href="https://scrapbox.io/glisp/">Doc</a></li>
				<li><a href="https://github.com/baku89/glisp-lang">Repo</a></li>
				<li><a href="https://github.com/sponsors/baku89">Support</a></li>
			</ul>
		</header>
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
			<pre><code class="repl">{{ result }}</code></pre>
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
	border-bottom 1px solid var(--color-on-surface)
	background var(--color-surface)
	height 3rem
	display flex
	padding 0 1rem
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

main
	max-width 50rem
.repl
	display block
	padding 1rem
	border-radius 1rem
	border 1px solid var(--color-on-surface)
	background var(--color-surface)
	color var(--color-on-surface)
</style>

<script setup lang="ts">
import {ref} from 'vue'
import {parse} from '../..'

const result = ref(
	parse('[(++ "Hello" " World") (+ 1 2)]').eval().result.print()
)

defineExpose({
	result,
})
</script>

<template>
	<h1>Glisp / REPL</h1>
	<hr />
	<p>
		A Lisp-based Design Tool Bridging Graphic Design and Computational Arts.
	</p>
	<code>{{ result }}</code>
</template>

<style scoped></style>

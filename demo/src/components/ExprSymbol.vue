<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref, shallowRef} from 'vue'

import {useGlispManager} from '../use/useGlispManager'
import ExprMinimal from './ExprMnimal.vue'
import InputString from './InputString.vue'

interface Props {
	expr: G.Symbol
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})

const exprRef = shallowRef(props.expr)

const emits = defineEmits<{
	(e: 'update:expr', newExpr: G.Expr): void
}>()

const symbolName = computed(() => exprRef.value.print())

const isSymbolNameInvalid = computed(() => {
	const ret = G.Parser.Symbol.parse(symbolName.value)
	return ret.status === false
})

const isEditing = ref(false)

function onInput(value: string) {
	const newExpr = G.Parser.Symbol.tryParse(value)
	emits('update:expr', newExpr)
}

const inputEl = ref<any>(null)

const manager = useGlispManager()

function onPointerdownArrow(e: PointerEvent) {
	isEditing.value = true

	const arrowEl = e.target

	window.addEventListener('pointerup', onPointerUp, {once: true})

	function onPointerUp(e: PointerEvent) {
		if (e.target === arrowEl) {
			inputEl.value.focus()
		} else {
			isEditing.value = false
		}

		manager.off('select')
	}

	manager.on('select', onSelectAnotherExpr)
	manager.on('unselect', onUnselectAnotherExpr)

	function onSelectAnotherExpr(toExpr: G.Expr) {
		const symbol = G.computeSymbol(props.expr, toExpr)
		if (!symbol) return
		exprRef.value = symbol
		emits('update:expr', symbol)
	}

	function onUnselectAnotherExpr() {}
}

function onBlurInput() {
	isEditing.value = false
}
</script>

<template>
	<div
		class="ExprSymbol"
		@pointerenter="manager.onPointerEnter(expr)"
		@pointerleave="manager.onPointerLeave()"
	>
		<span
			class="arrow-icon material-symbols-rounded"
			@pointerdown="onPointerdownArrow"
		>
			reply
		</span>
		<ExprMinimal v-if="!isEditing" :expr="exprRef" />
		<InputString
			v-else
			ref="inputEl"
			:modelValue="symbolName"
			:invalid="isSymbolNameInvalid"
			@update:modelValue="onInput"
			@blur="onBlurInput"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprSymbol
	text-align center
	position relative
	.arrow-icon
		display block
		top 0
		position absolute
		left 0
		height 100%
		aspect-ratio 1
		line-height var(--ui-input-height)
		font-size 1em
		border-radius var(--ui-input-border-radius)
		z-index 20
		user-select none

		&:hover
			background var(--color-primary)
			color var(--color-on-primary)
			cursor pointer
</style>

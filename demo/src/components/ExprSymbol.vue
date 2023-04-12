<script setup lang="ts">
import {useElementBounding, useMouse} from '@vueuse/core'
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

const tweaking = ref(false)
const editing = ref(false)

function onInput(value: string) {
	const newExpr = G.Parser.Symbol.tryParse(value)
	emits('update:expr', newExpr)
}

const inputEl = ref<any>(null)

const manager = useGlispManager()

function onPointerdownArrow() {
	tweaking.value = true
	editing.value = true

	window.addEventListener('pointerup', onPointerUp, {once: true})

	function onPointerUp(e: PointerEvent) {
		if (e.target === arrowEl.value) {
			inputEl.value.focus()
		} else {
			editing.value = false
		}

		tweaking.value = false

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
	editing.value = false
}

// Arrow
const arrowEl = ref<HTMLElement | null>(null)
const {left, right, top, bottom} = useElementBounding(arrowEl)

const arrowCenter = computed(() => {
	return [(left.value + right.value) / 2, (top.value + bottom.value) / 2]
})

const mouse = useMouse()
</script>

<template>
	<div
		class="ExprSymbol"
		@pointerenter="manager.onPointerEnter(expr)"
		@pointerleave="manager.onPointerLeave()"
	>
		<span
			ref="arrowEl"
			class="arrow-icon material-symbols-rounded"
			:class="{tweaking}"
			@pointerdown="onPointerdownArrow"
		>
			{{ tweaking ? '' : 'reply' }}
		</span>
		<ExprMinimal v-if="!editing" :expr="exprRef" />
		<InputString
			v-else
			ref="inputEl"
			class="input"
			:modelValue="symbolName"
			:invalid="isSymbolNameInvalid"
			:tweaked="editing"
			@update:modelValue="onInput"
			@blur="onBlurInput"
		/>
		<teleport to="body">
			<svg v-if="tweaking" class="ExprSymbol__overlay">
				<defs>
					<marker
						id="arrowhead"
						markerWidth="10"
						markerHeight="7"
						refX="2.5"
						refY="2"
						orient="auto"
						stroke-width="0"
						fill="var(--color-primary)"
					>
						<polygon points="0 0, 5 2, 0 4" />
					</marker>
				</defs>
				<line
					:x1="arrowCenter[0]"
					:y1="arrowCenter[1]"
					:x2="mouse.x.value"
					:y2="mouse.y.value"
					marker-end="url(#arrowhead)"
				/>
			</svg>
		</teleport>
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
	cursor pointer
	input-transition(all)

	&:hover, &.tweaking
		background var(--color-primary)
		color var(--color-on-primary)

	&.tweaking
		transform scale(.5)
		border-radius 50%

.input
	font-family var(--font-code)

:global(.ExprSymbol__overlay)
	position fixed
	inset 0
	width 100vw
	height 100vh
	z-index 999
	pointer-events none

	line
		stroke-width 4
		stroke var(--color-primary)
</style>

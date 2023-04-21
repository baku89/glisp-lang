<script setup lang="ts">
import {useElementBounding, useMouse} from '@vueuse/core'
import * as G from 'glisp'
import {computed, ref} from 'vue'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import ExprEvaluated from './ExprEvaluated.vue'
import InputString from './InputString.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Symbol
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		expectedType: () => G.all,
		hovered: false,
	}
)

const {exprRef, typeInvalid} = useExpr(props)

const emits = defineEmits<{
	(e: 'update:expr', newExpr: G.Expr): void
	(e: 'confirm'): void
	(e: 'cancel'): void
	(e: 'update:hovered', hovered: boolean): void
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

function onBlur() {
	editing.value = false
	emits('confirm')
}

const manager = useGlispManager()

// Tweak UI
const inputEl = ref<any>(null)

function beginTweak() {
	updateArrowBound()

	tweaking.value = true
	editing.value = true

	const originalExpr = props.expr

	manager.symbolType.value = props.expectedType

	window.addEventListener('pointerup', onPointerUp, {once: true})

	function onPointerUp(e: PointerEvent) {
		if (e.target === arrowEl.value) {
			inputEl.value.focus()
		} else {
			editing.value = false

			if (props.expr === originalExpr) {
				emits('cancel')
			} else {
				emits('confirm')
			}
		}

		tweaking.value = false

		manager.off('select', onSelectAnotherExpr)
		manager.off('unselect', onUnselectAnotherExpr)

		manager.symbolType.value = G.never
	}

	manager.on('select', onSelectAnotherExpr)
	manager.on('unselect', onUnselectAnotherExpr)

	function onSelectAnotherExpr(toExpr: G.Expr) {
		if (props.expr === toExpr) return

		const symbol = G.computeSymbol(props.expr, toExpr)
		if (!symbol) return
		emits('update:expr', symbol)
	}

	function onUnselectAnotherExpr() {
		emits('update:expr', originalExpr)
	}
}

// Arrow
const arrowEl = ref<HTMLElement | null>(null)
const {
	left,
	right,
	top,
	bottom,
	update: updateArrowBound,
} = useElementBounding(arrowEl, {})

const arrowCenter = computed(() => {
	return [(left.value + right.value) / 2, (top.value + bottom.value) / 2]
})

const mouse = useMouse()
</script>

<template>
	<div class="ExprSymbol">
		<span
			ref="arrowEl"
			class="arrow-icon material-symbols-rounded"
			:class="{tweaking}"
			@pointerdown="beginTweak"
		>
			{{ tweaking ? '' : 'reply' }}
		</span>
		<ExprEvaluated
			v-if="!editing"
			:hovered="hovered"
			:expr="exprRef"
			:expectedType="expectedType"
			@update:hovered="$emit('update:hovered', $event)"
		/>
		<InputString
			v-else
			ref="inputEl"
			class="input"
			:modelValue="symbolName"
			:invalid="isSymbolNameInvalid || typeInvalid"
			:tweaked="editing"
			@update:modelValue="onInput"
			@blur="onBlur"
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
	overflow hidden
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

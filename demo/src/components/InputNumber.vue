<script lang="ts" setup>
import {useElementBounding, useFocus, useKeyModifier} from '@vueuse/core'
import {useWheel} from '@vueuse/gesture'
import {clamp} from 'lodash'
import {computed, ref, watch, watchEffect} from 'vue'

import {useDrag} from '../use/useDrag'
import {fit, smoothstep, toFixedWithNoTrailingZeros, unsignedMod} from '../util'

const props = withDefaults(
	defineProps<{
		modelValue: number
		min?: number
		max?: number
		clampMin?: boolean
		clampMax?: boolean
		disabled?: boolean
		invalid?: boolean
		minSpeed?: number
		maxSpeed?: number
	}>(),
	{
		min: Number.MIN_SAFE_INTEGER,
		max: Number.MAX_SAFE_INTEGER,
		clampMin: true,
		clampMax: true,
		disabled: false,
		invalid: false,
		minSpeed: 0.0001,
		maxSpeed: 1000,
	}
)

const emits = defineEmits<{
	(e: 'update:modelValue', value: number): void
}>()

const root = ref()
const input = ref<HTMLInputElement | null>(null)

const local = ref(props.modelValue)
const display = ref(props.modelValue.toString())

const {left, top, right, width, height} = useElementBounding(root)

const alt = useKeyModifier('Alt')
const shift = useKeyModifier('Shift')

const hasRange = computed(() => {
	return (
		props.min !== Number.MIN_SAFE_INTEGER &&
		props.max !== Number.MAX_SAFE_INTEGER
	)
})

const validMin = computed(() =>
	props.clampMin ? props.min : Number.MIN_SAFE_INTEGER
)
const validMax = computed(() =>
	props.clampMax ? props.max : Number.MAX_SAFE_INTEGER
)

const speedMultiplierKey = computed(() => {
	return (alt.value ? 0.1 : 1) * (shift.value ? 10 : 1)
})
const speedMultiplierGesture = ref(1)
const speed = computed(() => {
	return speedMultiplierKey.value * speedMultiplierGesture.value
})

const getDisplayPrecision = () => {
	const floats = /\.[0-9]*$/.exec(display.value)
	return floats ? floats[0].length - 1 : 0
}
const displayPrecision = ref(0)

const tweakPrecision = computed(() => {
	const prec = Math.max(0, Math.ceil(-Math.log10(speed.value)))
	return Math.max(prec, displayPrecision.value)
})
const tweakInitialValue = ref(props.modelValue)

const tweakDirection = ref(0)
const pointerSize = ref(0)

let resetTweakModeTimer = -1
const tweakMode = ref<null | 'value' | 'speed'>(null)

const {dragging: tweaking} = useDrag(root, {
	lockPointer: true,
	disabled: computed(() => props.disabled || useFocus(input).focused.value),
	onClick() {
		input.value?.focus()
	},
	onDragStart(state, event) {
		const isTipDragged = (event.target as Element).classList.contains('tip')
		const insideRange = props.min <= local.value && local.value <= props.max
		if (hasRange.value && insideRange && !isTipDragged) {
			// Absolute mode
			local.value = fit(
				state.xy[0],
				left.value,
				right.value,
				props.min,
				props.max
			)
			emits('update:modelValue', local.value)
		}

		tweakMode.value = null
		tweakInitialValue.value = props.modelValue
		speedMultiplierGesture.value = 1
		displayPrecision.value = getDisplayPrecision()
	},
	onDrag(state, event) {
		const [dx, dy] = state.delta

		const isMouse = event.pointerType === 'mouse' || event.pointerType === 'pen'

		tweakDirection.value = dx
		pointerSize.value =
			event.width *
			0.75 *
			smoothstep(
				(event.width * 0.7) / 2,
				(event.width * 0.5) / 2,
				Math.abs(state.xy[1] - (top.value + height.value / 2))
			)

		if (state.pointerLocked) {
			scaleOffset.value = 0
		} else {
			scaleOffset.value = state.xy[0] - (left.value + width.value / 2)
		}

		if (!tweakMode.value) {
			if (isMouse) {
				tweakMode.value = Math.abs(dx) >= Math.abs(dy) ? 'value' : 'speed'
			} else {
				tweakMode.value = 'value'
			}
		}

		if (tweakMode.value === 'value') {
			const baseSpeed = hasRange.value
				? (props.max - props.min) / width.value
				: 1

			local.value = props.modelValue + dx * baseSpeed * speed.value
			local.value = clamp(local.value, validMin.value, validMax.value)
			emits('update:modelValue', local.value)
		} else {
			speedMultiplierGesture.value = clamp(
				speedMultiplierGesture.value * Math.pow(0.98, dy),
				props.minSpeed,
				props.maxSpeed
			)
		}

		if (isMouse) {
			clearTimeout(resetTweakModeTimer)
			resetTweakModeTimer = window.setTimeout(
				() => (tweakMode.value = null),
				250
			)
		}
	},
	onDragEnd() {
		display.value = toFixedWithNoTrailingZeros(
			props.modelValue,
			tweakPrecision.value
		)
		tweakMode.value = null
		speedMultiplierGesture.value = 1
	},
})

useWheel(
	({delta: [, y], event}) => {
		event.preventDefault()

		local.value = props.modelValue + y * speedMultiplierGesture.value
		local.value = clamp(local.value, validMin.value, validMax.value)
		display.value = props.modelValue.toFixed(tweakPrecision.value)

		emits('update:modelValue', local.value)
	},
	{domTarget: root, eventOptions: {passive: false}}
)

let hasChanged = false
let initialDisplay = ''

const onFocus = (e: FocusEvent) => {
	const el = e.target as HTMLInputElement
	el.select()
	hasChanged = false
	initialDisplay = display.value
}

const onInput = (e: Event) => {
	const el = e.target as HTMLInputElement

	display.value = el.value

	const value = parseFloat(el.value)
	if (isNaN(value)) return

	local.value = clamp(value, validMin.value, validMax.value)
	hasChanged = true

	emits('update:modelValue', local.value)
}

const increment = (delta: number) => {
	const prec = Math.max(
		getDisplayPrecision(),
		-Math.log10(speedMultiplierKey.value)
	)
	local.value += delta * speedMultiplierKey.value
	local.value = clamp(local.value, validMin.value, validMax.value)
	display.value = toFixedWithNoTrailingZeros(local.value, prec)
	hasChanged = true
	emits('update:modelValue', local.value)
}

const onBlur = () => {
	if (hasChanged) {
		display.value = props.modelValue.toString()
	} else {
		// 変な文字を打ったときはhasChanged === falseなので、これでリセットをかける
		display.value = initialDisplay
	}
}

watchEffect(() => {
	if (tweaking.value) {
		display.value = props.modelValue.toFixed(tweakPrecision.value)
	}
})

const fillStyle = computed(() => {
	const w =
		width.value * ((props.modelValue - props.min) / (props.max - props.min))

	return {width: w + 'px'}
})

const scaleOffset = ref(0)

const overlayTranslate = computed(() => {
	const tx = left.value + width.value / 2 + scaleOffset.value
	const ty = top.value + height.value / 2

	return `translate(${tx}, ${ty})`
})

const scaleAttrs = (offset: number) => {
	const precision = unsignedMod(
		-Math.log10(speedMultiplierGesture.value) + offset,
		3
	)
	const halfWidth = (width.value + height.value * 20) / 2

	const opacity = smoothstep(1, 2, precision)

	return {
		x1: -halfWidth,
		x2: halfWidth,
		style: {
			strokeDashoffset: -halfWidth,
			strokeDasharray: `0 ${Math.pow(10, precision)}`,
			opacity,
		},
	}
}

const cursorStyle = computed(() => {
	return {
		transform: `translateX(${scaleOffset.value}px)`,
		width: `${pointerSize.value}px`,
		marginLeft: `${pointerSize.value / -2}px`,
		opacity: smoothstep(
			width.value * 0.5,
			width.value * 0.6,
			Math.abs(scaleOffset.value)
		),
	}
})

// For iPad. Swiping with second finger to change the drag speed
window.addEventListener('touchstart', (e: TouchEvent) => {
	if (!tweaking.value) return

	const secondTouch = e.touches.item(1)
	if (!secondTouch) return

	const ox = secondTouch.clientX
	const initialSpeedMultiplierGesture = speedMultiplierGesture.value

	const stop = watch(tweaking, () => {
		window.removeEventListener('touchmove', onSecondTouchMove)
		window.removeEventListener('touchend', onSecondTouchEnd)
		stop()
	})

	window.addEventListener('touchmove', onSecondTouchMove)
	window.addEventListener('touchend', onSecondTouchEnd)

	function onSecondTouchMove(e: TouchEvent) {
		const firstTouch = e.touches.item(0)
		const secondTouch = e.touches.item(1)
		if (!firstTouch || !secondTouch) return

		const cx = firstTouch.clientX
		const x = secondTouch.clientX

		tweakMode.value = 'speed'

		const mul = Math.abs((ox - cx) / (x - cx))
		speedMultiplierGesture.value = clamp(
			initialSpeedMultiplierGesture * mul,
			props.minSpeed,
			props.maxSpeed
		)
	}

	function onSecondTouchEnd() {
		if (!e.touches.item(1)) return

		tweakMode.value = 'value'

		window.removeEventListener('touchmove', onSecondTouchMove)
		window.removeEventListener('touchend', onSecondTouchEnd)
	}
})
</script>

<template>
	<div
		ref="root"
		class="InputNumber"
		:class="{tweaking, invalid}"
		v-bind="$attrs"
	>
		<input
			ref="input"
			class="input"
			type="text"
			min="0"
			inputmode="numeric"
			pattern="d*"
			:value="display"
			:disabled="disabled"
			@focus="onFocus"
			@input="onInput"
			@blur="onBlur"
			@keydown.up.prevent="increment(1)"
			@keydown.down.prevent="increment(-1)"
		/>
		<div v-if="tweaking" class="signs" :style="cursorStyle">
			<span
				class="dec material-symbols-rounded"
				:class="{active: tweakMode === 'value' && tweakDirection < 0}"
			>
				remove
			</span>
			<span
				class="inc material-symbols-rounded"
				:class="{active: tweakMode === 'value' && tweakDirection > 0}"
			>
				add
			</span>
		</div>
		<div v-if="hasRange" class="slider">
			<div class="fill" :style="fillStyle">
				<div class="tip" />
			</div>
		</div>
	</div>
	<teleport to="#GlispUI__overlays">
		<svg v-if="tweaking" class="InputNumber__overlay">
			<g :transform="overlayTranslate">
				<g v-if="tweakMode === 'speed'">
					<line class="scale" v-bind="scaleAttrs(0)" />
					<line class="scale" v-bind="scaleAttrs(1)" />
					<line class="scale" v-bind="scaleAttrs(2)" />
				</g>
			</g>
		</svg>
	</teleport>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.InputNumber
	position relative
	input('.tweaking')
	text-align center
	user-select none
	width 100%

	&:not(:has(:disabled))
		cursor col-resize

	.input
		pointer-events none
		font-family var(--font-code)

		&:focus
			pointer-events auto

.signs
	position absolute
	inset 1px
	overflow hidden
	border-radius var(--ui-input-border-radius)
	color var(--color-outline-variant)

	&:not(.floating)
		width auto !important
		opacity 1 !important

.dec, .inc
	display block
	position absolute
	width var(--ui-inspector-tree-icon-size)
	height 100%
	text-align center
	transition .2s ease color
	font-size var(--ui-inspector-tree-icon-size)
	line-height calc(var(--ui-input-height) - 2px)
	font-smooth never
	-webkit-font-smoothing none

.active
	color var(--color-primary)

.dec
	left 0

.inc
	right 0

.slider
	position absolute
	inset 0
	mix-blend-mode darken
	border-radius var(--ui-input-border-radius)
	overflow hidden

	.fill
		position absolute
		height 100%
		background cyan

	.tip
		position absolute
		height 100%
		width 1px
		right -1px

		box-before()
			height 100%
			left calc(var(--ui-input-height) / -2)
			right @left

.tip:hover, &.tweaking .tip
		background var(--color-primary)

:global(.InputNumber__overlay)
		position fixed
		overflow visible
		pointer-events none
		top 0

		.scale
			fill none
			stroke-width 4
			stroke-linecap round
			stroke var(--color-primary)

		.pointer
			fill var(--color-primary)
</style>

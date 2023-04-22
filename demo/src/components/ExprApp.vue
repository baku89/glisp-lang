<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed} from 'vue'

import {useExpr} from '../use/useExpr'
import {useGlispManager} from '../use/useGlispManager'
import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Row from './Row.vue'

const props = withDefaults(
	defineProps<{
		expr: G.App
		expectedType?: G.Value
		hovered?: boolean
	}>(),
	{
		expectedType: () => G.all,
		hovered: false,
	}
)

const emits = defineEmits<{
	(e: 'update:hovered', hovered: boolean): void
}>()

const {exprRef} = useExpr(props)

interface ArgInfo {
	name: string
	suffix?: string
	expectedType: G.Value
}

const argInfos = computed<ArgInfo[]>(() => {
	const {fn} = exprRef.value

	if (!fn) return []

	const fnInferred = fn.infer()

	if (!('fnType' in fnInferred)) return []

	const {fnType} = fnInferred.fnType

	const names: ArgInfo[] = entries(fnType.params).map(
		([name, expectedType]) => {
			const label = expectedType.getMetaValue<G.String>('label', G.StringType)
			if (label) {
				name = label.value
			}

			return {
				name,
				expectedType,
			}
		}
	)

	if (fnType.rest) {
		let name = fnType.rest.name
		const expectedType = fnType.rest.value
		const restArgNum = exprRef.value.args.length - names.length

		const label = expectedType.getMetaValue<G.String>('label', G.StringType)
		if (label) {
			name = label.value
		}

		names.push(
			...Array(restArgNum)
				.fill(null)
				.map((_, i) => ({name, suffix: i.toString(), expectedType}))
		)
	}

	return names
})

const {commit, tagHistory, cancelTweak} = injectGlispUndoRedo()

function set(path: number, expr: G.Expr) {
	commit(props.expr, {type: 'set', path, expr})
}

const manager = useGlispManager()

function onHover() {
	emits('update:hovered', true)
	manager.onPointerEnter(props.expr)
}

function onUnhover() {
	emits('update:hovered', false)
	manager.onPointerLeave()
}
</script>

<template>
	<div class="ExprApp" :class="{hovered}">
		<div
			class="hover-region"
			@pointerenter="onHover"
			@pointerleave="onUnhover"
		/>
		<Row
			v-if="exprRef.fn"
			:expr="exprRef.fn"
			@update:expr="set(0, $event)"
			@confirm="tagHistory"
			@cancel="cancelTweak"
		>
			<template #label>ƒ</template>
		</Row>
		<Row
			v-for="(arg, i) in exprRef.args"
			:key="i"
			:expr="arg"
			:expectedType="argInfos[i].expectedType"
			@update:expr="set(i + 1, $event)"
			@confirm="tagHistory"
			@cancel="cancelTweak"
		>
			<template #label>
				<span>{{ argInfos[i].name }}</span>
				<span v-if="argInfos[i].suffix" class="suffix">
					{{ argInfos[i].suffix }}
				</span>
			</template>
		</Row>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprApp
	position relative
	font-family var(--font-code)
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)
	font-family var(--font-ui)
	padding-left var(--ui-inspector-tree-icon-size)

	--l-indent-color var(--color-outline-variant)
	--l-indent-width 1px
	&.hovered
		--l-indent-color var(--color-primary)
		--l-indent-width 2px


	+box-before()
		left calc(var(--ui-inspector-tree-icon-size) / 2)
		top calc(var(--ui-input-row-margin) * -1)
		bottom 0
		width calc(var(--ui-input-row-margin) * .75)
		border var(--l-indent-width) solid var(--l-indent-color)
		border-right 0
		border-top 0
		border-bottom-left-radius 9999px
		input-transition(border)

.suffix
	font-family var(--font-code)
	color var(--color-outline)

	&:before
		padding-left .1em
		content '.'
		font-family var(--font-ui)

.hover-region
	position absolute
	left 0
	top calc(var(--ui-input-row-margin) * -1)
	bottom 0
	width var(--ui-inspector-tree-icon-size)
	z-index 10
</style>

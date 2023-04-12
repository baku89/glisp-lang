<script setup lang="ts">
import * as G from 'glisp'
import {keys} from 'lodash'
import {computed, shallowRef, triggerRef} from 'vue'

import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Expr from './ExprAll.vue'
import ExprMnimal from './ExprMnimal.vue'
import Row from './Row.vue'

const props = withDefaults(
	defineProps<{
		expr: G.App
		valueType?: G.Value
		layout?: 'expanded' | 'collapsed' | 'minimal'
	}>(),
	{
		valueType: () => G.all,
		layout: 'expanded',
	}
)

const exprRef = shallowRef(props.expr)

exprRef.value.on('edit', () => triggerRef(exprRef))

const argNames = computed<[string, string][]>(() => {
	const {fn} = exprRef.value

	if (!fn) return []

	const fnInferred = fn.infer()

	if (!('fnType' in fnInferred)) return []

	const {fnType} = fnInferred.fnType

	const names: [string, string][] = keys(fnType.params).map(n => [n, ''])

	if (fnType.rest) {
		const restName = fnType.rest.name
		const restArgNum = exprRef.value.args.length - names.length

		names.push(
			...Array(restArgNum)
				.fill(null)
				.map((_, i) => [restName, i.toString()] as [string, string])
		)
	}

	return names
})

const {commit, tagHistory} = injectGlispUndoRedo()

function set(path: number, expr: G.Expr) {
	if (!commit) throw new Error()
	commit(props.expr, {type: 'set', path, expr})
}
</script>

<template>
	<div v-if="layout === 'expanded'" class="ExprApp--expanded">
		<Row v-if="exprRef.fn" :expanded="false" :expandable="false">
			<template #label>ƒ</template>
			<Expr
				:expr="exprRef.fn"
				@update:expr="set(0, $event)"
				@confirm="tagHistory"
			/>
		</Row>
		<Row
			v-for="(arg, i) in exprRef.args"
			:key="i"
			:expanded="false"
			:expandable="false"
		>
			<template #label>
				<span>{{ argNames[i][0] }}</span>
				<span v-if="argNames[i][1]" class="suffix">{{ argNames[i][1] }}</span>
			</template>
			<Expr
				:expr="arg"
				@update:expr="set(i + 1, $event)"
				@confirm="tagHistory"
			/>
		</Row>
	</div>
	<ExprMnimal v-else class="ExprApp--minimal" :expr="expr" />
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprApp
	&--expanded
		position relative
		font-family var(--font-code)
		display flex
		flex-direction column
		gap var(--ui-input-row-margin)
		font-family var(--font-ui)
		padding-left var(--ui-inspector-tree-icon-size)

		+box-before()
			left calc(var(--ui-inspector-tree-icon-size) / 2)
			top calc(var(--ui-input-row-margin) * -1)
			bottom 0
			width calc(var(--ui-input-row-margin) * .75)
			border 1px solid var(--color-outline-variant)
			border-right 0
			border-top 0
			border-bottom-left-radius 9999px

	&--collapsed
		display grid
		grid-template-columns: repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
		gap var(--ui-input-gap)

	&--minimal
		font-family var(--font-code)

.suffix
	font-family var(--font-code)
	color var(--color-outline)

	&:before
		padding-left .1em
		content '.'
		font-family var(--font-ui)

.collapsed-fn
	box-shadow inset 0 0 0 2px var(--color-surface-variant) !important
	text-align center !important
	border-radius calc(var(--ui-input-height) / 2) var(--ui-input-border-radius) var(--ui-input-border-radius) calc(var(--ui-input-height) / 2) !important
	background var(--color-background) !important
</style>

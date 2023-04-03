<script setup lang="ts">
import * as G from 'glisp'
import {keys} from 'lodash'
import {computed} from 'vue'

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

const argNames = computed<[string, string][]>(() => {
	const {fn} = props.expr

	if (!fn) return []

	const fnInferred = fn.infer().value

	if (!('fnType' in fnInferred)) return []

	const {fnType} = fnInferred.fnType

	const names: [string, string][] = keys(fnType.params).map(n => [n, ''])

	if (fnType.rest) {
		const restName = fnType.rest.name
		const restArgNum = props.expr.args.length - names.length

		names.push(
			...Array(restArgNum)
				.fill(null)
				.map((_, i) => [restName, i.toString()] as [string, string])
		)
	}

	return names
})

function setChild(path: number, newExpr: G.Expr) {
	props.expr.setChild(path, newExpr)
	G.notifyChangedExprs()
}
</script>

<template>
	<div v-if="layout === 'expanded'" class="ExprApp--expanded">
		<Row v-if="expr.fn" :expanded="false" :expandable="false">
			<template #label>ƒ</template>
			<Expr :expr="expr.fn" @update:expr="setChild(0, $event)" />
		</Row>
		<Row
			v-for="(arg, i) in expr.args"
			:key="i"
			:expanded="false"
			:expandable="false"
		>
			<template #label>
				<span>{{ argNames[i][0] }}</span>
				<span v-if="argNames[i][1]" class="suffix">@{{ argNames[i][1] }}</span>
			</template>
			<Expr :expr="arg" @update:expr="setChild(i + 1, $event)" />
		</Row>
	</div>
	<div v-else-if="layout === 'collapsed'" class="ExprApp--collapsed">
		<Expr
			v-if="expr.fn"
			class="collapsed-fn"
			:expr="expr.fn"
			@update:expr="setChild(0, $event)"
		/>
		<Expr
			v-for="(item, i) in expr.args"
			:key="i"
			class="item"
			:expr="item"
			layout="minimal"
			@update:expr="setChild(i + 1, $event)"
		/>
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
			bottom calc(var(--ui-input-row-margin) * -0.5)
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
	color var(--color-outline-variant)

.collapsed-fn
	box-shadow inset 0 0 0 2px var(--color-surface-variant) !important
	text-align center !important
	border-radius calc(var(--ui-input-height) / 2) var(--ui-input-border-radius) var(--ui-input-border-radius) calc(var(--ui-input-height) / 2) !important
	background var(--color-background) !important
</style>

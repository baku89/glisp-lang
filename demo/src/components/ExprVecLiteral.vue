<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref} from 'vue'

import Expr from './ExprAll.vue'
import ExprMnimal from './ExprMnimal.vue'
import Row from './Row.vue'

interface Props {
	expr: G.VecLiteral
	valueType?: G.Value
	layout?: 'expanded' | 'collapsed' | 'minimal'
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.vec([], undefined, G.all),
	layout: 'expanded',
})

const items = computed(() => {
	return props.expr.items.map((item, index) => {
		const expandable = !(item.type === 'Literal' || item.type === 'Symbol')

		const expanded = itemExpanded.value.has(index) && expandable

		return [index, item, expandable, expanded] as const
	})
})

const itemExpanded = ref(new Set<number>())

function setItemExpanded(index: number, expanded: boolean) {
	if (expanded) {
		itemExpanded.value.add(index)
	} else {
		itemExpanded.value.delete(index)
	}
}

function setChild(path: number, newExpr: G.Expr) {
	props.expr.setChild(path, newExpr)
	G.notifyChangedExprs()
}
</script>

<template>
	<div v-if="layout === 'expanded'" class="ExprVecLiteral--expanded">
		<Row
			v-for="[i, item, expandable, expanded] in items"
			:key="i"
			:expandable="expandable"
			:expanded="expanded"
			@update:expanded="setItemExpanded(i, $event)"
		>
			<Expr
				:expr="item"
				:layout="expanded ? 'expanded' : 'collapsed'"
				@update:expr="setChild(i, $event)"
			/>
		</Row>
	</div>
	<div v-else-if="layout === 'collapsed'" class="ExprVecLiteral--collapsed">
		<Expr
			v-for="(item, i) in expr.items"
			:key="i"
			class="item"
			:expr="item"
			layout="minimal"
			@update:expr="setChild(i, $event)"
		/>
	</div>
	<ExprMnimal v-else class="ExprVecLiteral--minimal" :expr="expr" />
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprVecLiteral
	&--expanded
		position relative
		font-family var(--font-code)
		display flex
		flex-direction column
		gap var(--ui-input-row-margin)
		font-family var(--font-ui)
		padding-left calc(var(--ui-input-height) * .666)

		+box-before()
			left calc(var(--ui-input-height) / 3)
			width calc(var(--ui-input-row-margin) * .75)
			border 1px solid var(--color-outline-variant)
			border-right 0
			border-top 0
			bottom calc(var(--ui-input-row-margin) * -0.5)
			top calc(var(--ui-input-row-margin) * -1)

	&--collapsed
		display grid
		grid-template-columns: repeat(auto-fill, minmax(var(--ui-input-col-width), 1fr))
		gap var(--ui-input-gap)
</style>

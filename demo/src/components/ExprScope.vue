<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed, ref} from 'vue'

import Expr from './ExprAll.vue'
import ExprMnimal from './ExprMnimal.vue'
import Row from './Row.vue'

interface Props {
	expr: G.Scope
	valueType?: G.Value
	layout?: 'expanded' | 'collapsed' | 'minimal'
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
	layout: 'expanded',
})

const items = computed(() => {
	return entries(props.expr.items).map(([name, expr]) => {
		const expandable = !(expr.type === 'Literal' || expr.type === 'Symbol')

		return [
			name,
			expr,
			expandable,
			itemExpanded.value.has(name) && expandable,
		] as const
	})
})

const itemExpanded = ref(new Set<string>())

function setItemExpanded(name: string, expanded: boolean) {
	if (expanded) {
		itemExpanded.value.add(name)
	} else {
		itemExpanded.value.delete(name)
	}
}

const retExpanded = ref(false)
</script>

<template>
	<div class="ExprScope">
		<div v-if="layout === 'expanded'" class="expanded">
			<div class="items">
				<Row
					v-for="[name, e, expandable, expanded] in items"
					:key="name"
					:expanded="expanded"
					:expandable="expandable"
					@update:expanded="setItemExpanded(name, $event)"
				>
					<template #label>{{ name }}:</template>
					<Expr
						:expr="e"
						:layout="expanded ? 'expanded' : 'collapsed'"
						@update:expr="expr.setChild(name, $event)"
					/>
				</Row>
			</div>
			<Row
				v-if="expr.ret"
				v-model:expanded="retExpanded"
				class="ret"
				:expandable="true"
			>
				<template #label>Return</template>
				<Expr
					class="value"
					:expr="expr.ret"
					:layout="retExpanded ? 'expanded' : 'collapsed'"
					@update:expr="expr.setChild('return', $event)"
				/>
			</Row>
		</div>
		<ExprMnimal v-else class="collapsed" :expr="expr" />
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprScope
	position relative
	font-family var(--font-ui)

	& > .expanded
		display flex
		flex-direction column
		gap var(--ui-input-row-margin)

		&:after
			content 'L'
			position absolute
			top calc(var(--ui-input-height) / 2)
			left 0
			background var(--color-outline-variant)
			color var(--color-background)
			border-radius 9999px
			display block
			aspect-ratio 1
			width var(--ui-inspector-tree-icon-size)
			height var(--ui-inspector-tree-icon-size)
			line-height var(--ui-inspector-tree-icon-size)
			text-align center
			font-weight 900
			font-family var(--font-code)
			font-size calc(var(--ui-inspector-tree-icon-size) * 0.8)
			transform translateY(-50%) scale(.8)

.items, .ret
	padding-left var(--ui-inspector-tree-icon-size)

.items
	position relative
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)

	+box-before()
		left calc(var(--ui-inspector-tree-icon-size) / 2)
		width 0
		border-left 1px dashed var(--color-outline-variant)
		height 100%

.ret
	position relative
	border-style solid

	&:before, &:after
		content ''
		display block
		position absolute
		left calc(var(--ui-inspector-tree-icon-size) / 2)

	+box-before()
		width calc(var(--ui-input-row-margin) * .75)
		border-bottom-left-radius var(--ui-input-row-margin)
		border-left 3px solid var(--color-outline-variant)
		border-bottom @border-left
		top calc(var(--ui-input-row-margin) * -1)
		bottom calc(var(--ui-input-row-margin) * -0.5)
		margin-left -1px

		&:first-child
			top 0
</style>

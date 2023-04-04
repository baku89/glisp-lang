<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed, ref, shallowRef, triggerRef} from 'vue'

import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
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

const exprRef = shallowRef(props.expr)

exprRef.value.on('edit', () => {
	triggerRef(exprRef)
})

const items = computed(() => {
	return entries(exprRef.value.items).map(([name, e]) => {
		const expandable = !(e.type === 'Literal' || e.type === 'Symbol')

		return [
			name,
			e,
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

const retExpandable = computed(() => {
	const type = exprRef.value.ret?.type
	return !(type === 'Literal' || type === 'Symbol')
})

const retExpanded = ref(false)

const {commit, tagHistory} = injectGlispUndoRedo()

function set(path: string, expr: G.Expr) {
	commit(props.expr, {type: 'set', path, expr})
}
</script>

<template>
	<div class="ExprScope">
		<div v-if="layout === 'expanded'" class="expanded">
			<div class="items">
				<Row
					v-for="[path, e, expandable, expanded] in items"
					:key="path"
					:expanded="expanded"
					:expandable="expandable"
					@update:expanded="setItemExpanded(path, $event)"
				>
					<template #label>{{ path }}:</template>
					<Expr
						:expr="e"
						:layout="expanded ? 'expanded' : 'collapsed'"
						@update:expr="set(path, $event)"
						@confirm="tagHistory"
					/>
				</Row>
			</div>
			<Row
				v-if="expr.ret"
				v-model:expanded="retExpanded"
				class="ret"
				:expandable="retExpandable"
			>
				<template #label>Return</template>
				<Expr
					class="value"
					:expr="expr.ret"
					:layout="retExpanded ? 'expanded' : 'collapsed'"
					@update:expr="set('return', $event)"
					@confirm="tagHistory"
				/>
			</Row>
		</div>
		<ExprMnimal v-else :expr="expr" />
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

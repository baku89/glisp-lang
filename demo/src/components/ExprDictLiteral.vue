<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed, ref} from 'vue'

import {useExpr} from '../use/useExpr'
import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Expr from './ExprAll.vue'
import ExprMnimal from './ExprMnimal.vue'
import Row from './Row.vue'

interface Props {
	expr: G.DictLiteral
	expectedType?: G.Value
	layout?: 'expanded' | 'collapsed' | 'minimal'
}

const props = withDefaults(defineProps<Props>(), {
	expectedType: () => G.all,
	layout: 'expanded',
})

const {exprRef} = useExpr(props)

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
		</div>
		<ExprMnimal v-else :expr="exprRef" />
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

.items
	position relative
	display flex
	flex-direction column
	gap var(--ui-input-row-margin)
	padding-left var(--ui-inspector-tree-icon-size)

	+box-before()
		top calc(var(--ui-input-row-margin) * -1)
		bottom 0
		left calc(var(--ui-inspector-tree-icon-size) / 2)
		border 1px solid var(--color-outline-variant)
		border-right 0
		border-top 0
		width calc(var(--ui-input-row-margin) * .75)
		border-bottom-left-radius 9999px
</style>

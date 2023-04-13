<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed, ref} from 'vue'

import {useExpr} from '../use/useExpr'
import {injectGlispUndoRedo} from '../use/useGlispUndoRedo'
import Expr from './ExprAll.vue'
import ExprMnimal from './ExprMnimal.vue'
import Row from './Row.vue'

const props = withDefaults(
	defineProps<{
		expr: G.Scope
		expectedType?: G.Value
		layout?: 'expanded' | 'collapsed' | 'minimal'
	}>(),
	{
		expectedType: () => G.all,
		layout: 'expanded',
	}
)

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

const retExpandable = computed(() => {
	const type = exprRef.value.ret?.type
	return !(type === 'Literal' || type === 'Symbol')
})

const retExpanded = ref(false)

const {commit, tagHistory, cancelTweak} = injectGlispUndoRedo()

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
						@cancel="cancelTweak"
					/>
				</Row>
			</div>
			<Row
				v-if="exprRef.ret"
				v-model:expanded="retExpanded"
				class="return"
				:expandable="retExpandable"
			>
				<template #label>Return</template>
				<Expr
					class="value"
					:expr="exprRef.ret"
					:layout="retExpanded ? 'expanded' : 'collapsed'"
					@update:expr="set('return', $event)"
					@confirm="tagHistory"
					@cancel="cancelTweak"
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

.items, .return
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

.return
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

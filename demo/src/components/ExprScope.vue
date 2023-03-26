<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed, ref} from 'vue'

import Expr from './Expr.vue'

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

function toggleItemExpanded(name: string) {
	if (itemExpanded.value.has(name)) {
		itemExpanded.value.delete(name)
	} else {
		itemExpanded.value.add(name)
	}
}
</script>

<template>
	<div class="ExprScope">
		<div v-if="layout === 'expanded'" class="expanded">
			<div class="items">
				<div
					v-for="[name, e, expandable, expanded] in items"
					:key="name"
					class="row"
					:class="{expanded}"
				>
					<div class="key">
						<button
							class="key__icon material-symbols-rounded"
							:class="{expandable}"
							@click="() => toggleItemExpanded(name)"
						>
							{{ expandable ? 'chevron_right' : '・' }}
						</button>
						<div class="key__label">{{ name }}:</div>
					</div>
					<Expr
						class="value"
						:expr="e"
						:layout="expanded ? 'expanded' : 'collapsed'"
					/>
				</div>
			</div>
			<div v-if="expr.out" class="ret row">
				<div class="key">
					<button class="key__icon material-symbols-rounded">
						chevron_right
					</button>
					<div class="key__label">Return</div>
				</div>
				<Expr class="value" :expr="expr.out" />
			</div>
		</div>
		<div v-else class="collapsed">{{ expr.eval().value.print() }}</div>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprScope
	position relative
	font-family var(--font-ui)

	& > .expanded
		padding-left var(--ui-input-height)
		display flex
		flex-direction column
		gap var(--ui-input-vert-margin)

		&:after
			content 'l'
			position absolute
			top 0
			left 0
			background black
			color var(--color-background)
			border-radius 9999px
			display block
			aspect-ratio 1
			width var(--ui-input-height)
			height var(--ui-input-height)
			line-height var(--ui-input-height)
			text-align center
			font-weight bold
			font-family var(--font-code)
			font-size calc(var(--ui-input-height) * 0.85)
			transform scale(.6)


.items
	position relative
	display flex
	flex-direction column
	gap var(--ui-input-vert-margin)

	&:before
		content ''
		display block
		position absolute
		left calc(var(--ui-input-height) / -2)
		width 0
		border-left 1px dashed black
		height 100%

.row
	display flex
	gap var(--ui-input-vert-margin) 0

	&.expanded
		flex-direction column
		& > .key > .key__icon
			transform rotate(90deg)

.key
	display flex
	align-items center
	height var(--ui-input-height)
	width var(--ui-inspector-header-width)
	--ui-inspector-header-width 8rem


	&__icon
		font-size 18px
		width 18px
		height 18px
		transition transform .1s ease
		cursor pointer

		&:not(.expandable)
			cursor initial
			transform none !important

	&__label
		line-height var(--ui-input-height)
		padding-left .2em


.value
	flex-grow 1

.expr
	font-family var(--font-code)

.ret
	position relative
	border-style solid

	&:before, &:after
		content ''
		display block
		position absolute
		left calc(var(--ui-input-height) / -2)

	&:before
		width var(--ui-input-vert-margin)
		border-bottom-left-radius var(--ui-input-vert-margin)
		border-left 3px solid black
		border-bottom 3px solid black
		top calc(var(--ui-input-vert-margin) * -1)
		bottom 0
		margin-left -1px

		&:first-child
			top 0
</style>

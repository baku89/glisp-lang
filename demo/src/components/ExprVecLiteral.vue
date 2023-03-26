<script setup lang="ts">
import * as G from 'glisp'

import Expr from './Expr.vue'

interface Props {
	expr: G.VecLiteral
	valueType?: G.Value
}

withDefaults(defineProps<Props>(), {
	valueType: () => G.vec([], undefined, G.all),
})
</script>

<template>
	<div class="ExprVecLiteral">
		<div v-for="(item, i) in expr.items" :key="i" class="row">
			<div class="key">
				<button class="key__icon material-symbols-rounded">expand_more</button>
				<div class="key__label">{{ i }}</div>
			</div>
			<Expr class="value collapsed" :expr="item" />
		</div>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.ExprVecLiteral
	position relative
	font-family var(--font-code)
	display flex
	flex-direction column
	gap var(--ui-input-vert-margin)
	font-family var(--font-ui)

	&:before
		content ''
		display block
		position absolute
		left calc(var(--ui-input-height) / 2)
		width calc(var(--ui-input-vert-margin) * .75)
		border 1px solid black
		border-right 0
		height 100%

.row
	display flex
	gap var(--ui-input-vert-margin)
	font-family var(--font-ui)
	padding-left var(--ui-input-height)

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
</style>

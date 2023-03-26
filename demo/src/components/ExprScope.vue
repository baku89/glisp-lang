<script setup lang="ts">
import * as G from 'glisp'
import {entries} from 'lodash'
import {computed} from 'vue'

interface Props {
	expr: G.Scope
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})

const items = computed(() => {
	return entries(props.expr.items)
})
</script>

<template>
	<div class="ExprScope">
		<div class="header">
			<div class="icon material-symbols-rounded">expand_more</div>
			<div class="exprType">Let</div>
		</div>
		<div class="children">
			<dl class="items">
				<div v-for="[name, e] in items" :key="name" class="row">
					<dt class="name">{{ name }}</dt>
					<dd class="expr">{{ e.print() }}</dd>
				</div>
			</dl>
		</div>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
.ExprScope
	font-family var(--font-ui)

.header
	display flex
	height 1.25rem
.icon
	font-size 1.25rem
	width 1.25rem
	aspect-ratio 1
.exprType
	line-height 1.25rem
	padding-left .25rem
.children
	position relative
	padding-left 1.25rem

	&:before
		content ''
		display block
		position absolute
		left (1.25 / 2rem)
		width 1px
		height 100%
		background black

.row
	display flex

.name
	width 8rem
</style>

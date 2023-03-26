<script setup lang="ts">
interface Props {
	align?:
		| 'none'
		| 'top'
		| 'right'
		| 'bottom'
		| 'left'
		| 'top-left'
		| 'top-right'
		| 'bottom-right'
		| 'bottom-left'
}

withDefaults(defineProps<Props>(), {align: 'none'})
</script>

<template>
	<div class="Surface" :class="align">
		<slot />
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.Surface
	t = transparent
	b = var(--color-surface-border)

	background var(--color-surface)
	border 1px solid b
	border-radius var(--ui-surface-radius)

	&.top
		border-color t t b t
		border-radius 0
	&.top-left
		border-color t b b t
		border-radius 0 0 var(--ui-surface-radius) 0
</style>

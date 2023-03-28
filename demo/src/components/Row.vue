<script setup lang="ts">
interface Props {
	expandable: boolean
	expanded: boolean
}

const props = defineProps<Props>()

interface Emits {
	(e: 'update:expanded', value: boolean): void
}

const emits = defineEmits<Emits>()

function onClickChevron() {
	if (!props.expandable) return

	emits('update:expanded', !props.expanded)
}
</script>

<template>
	<div class="Row" :class="{expanded}">
		<div class="Row__key">
			<button
				class="Row__icon material-symbols-rounded"
				:class="{expandable}"
				@click="onClickChevron"
			>
				{{ expandable ? 'chevron_right' : '・' }}
			</button>
			<div v-if="$slots.label" class="Row__label">
				<slot name="label" />
			</div>
		</div>
		<slot class="Row__value" />
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.Row
	display grid
	grid-template-columns min-content 1fr
	gap var(--ui-input-row-margin) 0

	&.expanded
		grid-template-columns 1fr
		& > .Row__key > .Row__icon
			transform rotate(90deg)

	&__key
		user-select none
		display flex
		align-items center
		font-size var(--ui-input-font-size)
		height var(--ui-input-height)


	&__icon
		// background red
		font-size var(--ui-inspector-tree-icon-size)
		width var(--ui-inspector-tree-icon-size)
		height var(--ui-inspector-tree-icon-size)
		input-transition(transform)
		cursor pointer
		color var(--color-outline)

		&:not(.expandable)
			cursor initial
			transform none !important

	&__label
		width var(--ui-inspector-header-width)
		line-height var(--ui-input-height)
		padding-left .2em
</style>

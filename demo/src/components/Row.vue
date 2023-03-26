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
		<div class="key">
			<button
				class="key__icon material-symbols-rounded"
				:class="{expandable}"
				@click="onClickChevron"
			>
				{{ expandable ? 'chevron_right' : '・' }}
			</button>
			<div class="key__label">
				<slot name="label" />
			</div>
		</div>
		<div class="value">
			<slot />
		</div>
	</div>
</template>

<style lang="stylus" scoped>
@import '@/common.styl'

.Row
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
</style>

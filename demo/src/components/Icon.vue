<script setup lang="ts">
defineProps({
	src: String,
})
</script>

<template><div class="SvgIcon" :style="{maskImage: `url(${src})`}" /></template>

<style scoped lang="stylus">
.SvgIcon
	background-color currentColor
	aspect-ratio 1
</style>

<script lang="ts" setup>
import {Log, print} from '@glisp/lang'

defineProps<{
	log: Log
}>()
</script>

<template>
	<div class="ConsoleLog">
		<span class="icon">{{ log.level }}</span>
		<span class="reason">
			<template v-for="([type, value], i) in log.reason">
				<span class="string" v-if="type === 'string'">{{ value }}</span>
				<span class="ast" v-else-if="type === 'ast'">{{ print(value) }}</span>
			</template>
		</span>
	</div>
</template>

<style lang="stylus" scoped>

.icon
	margin-right .5em

.string
	font-family var(--font-family)
	letter-spacing 0

.ast
	font-size .98em
	padding 0 .2em
	font-weight 400
</style>

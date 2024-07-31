<script lang="ts" setup></script>

<template>
	<ClientOnly>
		<div class="Repl">
			<div>Code</div>
			<div>Console</div>
		</div>
	</ClientOnly>
</template>

<style lang="stylus">
.Repl
	display grid
	grid-template-columns 1fr 1fr
</style>

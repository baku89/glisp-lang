<script setup lang="ts">
import * as G from 'glisp'
import {computed, ref} from 'vue'

import InputNumber from './InputNumber.vue'
import InputString from './InputString.vue'

interface Props {
	expr: G.Literal
	valueType?: G.Value
}

const props = withDefaults(defineProps<Props>(), {
	valueType: () => G.all,
})

const value = ref(props.expr.value)

const inputComponent = computed(() => {
	switch (typeof value.value) {
		case 'string':
			return InputString
		default:
			return InputNumber
	}
})
</script>

<template>
	<component :is="inputComponent" v-model="value" class="ExprLiteral" />
</template>

<style lang="stylus" scoped>
@import '@/common.styl'
</style>

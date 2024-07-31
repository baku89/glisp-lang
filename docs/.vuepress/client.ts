import {ClientConfig} from '@vuepress/client'

import Repl from '../components/Repl.vue'

export default {
	enhance({app}) {
		app.component('Repl', Repl)
	},
} as ClientConfig

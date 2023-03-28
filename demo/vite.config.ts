import vue from '@vitejs/plugin-vue'
import path from 'path'
import {defineConfig} from 'vite'
import vitePluginStylusAlias from 'vite-plugin-stylus-alias'

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		plugins: [vue(), vitePluginStylusAlias.default()],
		base: './',
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
				glisp: path.resolve(__dirname, '..'),
			},
		},
	}
})

import vue from '@vitejs/plugin-vue'
import path from 'path'
import {defineConfig} from 'vite'
import vitePluginStylusAlias from 'vite-plugin-stylus-alias'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [vue(), vitePluginStylusAlias.default()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			glisp: path.resolve(__dirname, '..'),
		},
	},
})

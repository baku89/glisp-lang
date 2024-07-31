import {defineUserConfig} from 'vuepress'
import {path} from '@vuepress/utils'
import {defaultTheme} from '@vuepress/theme-default'
import {viteBundler} from '@vuepress/bundler-vite'

export default defineUserConfig({
	title: 'glisp/lang',
	base: '/glisp-lang/',
	alias: {
		'@glisp/lang': path.resolve(__dirname, '../../src'),
	},
	head: [
		['link', {rel: 'icon', href: './logo.svg'}],
		['link', {rel: 'preconnect', href: 'https://fonts.googleapis.com'}],
		[
			'link',
			{rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true},
		],
		['link', {rel: 'stylesheet', href: 'https://use.typekit.net/xhr6teg.css'}],
		[
			'link',
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Fira+Code:wght@300..700&display=swap',
				crossorigin: 'anonymous',
			},
		],
		[
			'script',
			{
				src: 'https://cdn.jsdelivr.net/npm/ccapture.js-npmfixed@1.1.0/build/CCapture.all.min.js',
				crossorigin: 'anonymous',
			},
		],
	],
	theme: defaultTheme({
		navbar: [
			{
				text: 'Home',
				link: '/',
			},
			{
				text: 'REPL',
				link: '/repl',
			},
		],
		logo: '/logo.svg',
		repo: 'baku89/glisp-lang',
	}),
	locales: {
		'/': {
			lang: 'English',
			title: 'glisp/lang',
			description: 'The lisp dialect for visual programming and toolmaking',
		},
		'/ja/': {
			lang: '日本語',
			title: 'glisp/lang',
			description: '制作ツールづくりやビジュアルプログラミングのためのLisp方言',
		},
	},
	bundler: viteBundler({
		viteOptions: {},
	}),
	markdown: {
		//@ts-ignore
		linkify: true,
		typographer: true,
		code: {
			lineNumbers: false,
		},
	},
})

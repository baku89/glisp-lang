module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	env: {
		node: true,
		commonjs: true,
		'jest/globals': true,
	},
	extends: ['eslint:recommended', 'prettier'],

	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
	},
	plugins: ['jest', 'simple-import-sort', 'unused-imports'],
	rules: {
		'no-console': 'warn',
		'no-debugger': 'warn',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-use-before-define': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'simple-import-sort/imports': 'error',
		'unused-imports/no-unused-imports-ts': 'error',
	},
}

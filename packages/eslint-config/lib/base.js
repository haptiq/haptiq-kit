/**
 * Base config — suitable for any browser-targeting JS project.
 * Enables js.recommended, browser globals, and a minimal rule set.
 * Extend with `react` or `node` for framework/runtime-specific rules.
 */
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	{
		plugins: {
			'@stylistic': stylistic,
		},
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
		rules: {
			'no-console': 'warn',
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
]

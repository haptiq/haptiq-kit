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
			'no-var': 'error',
			'prefer-const': 'error',
			'eqeqeq': ['error', 'always'],
			'object-shorthand': ['error', 'always'],
			'prefer-template': 'error',
			'no-duplicate-imports': 'error',
			'@stylistic/array-bracket-newline': ['error', { multiline: true }],
			'@stylistic/array-bracket-spacing': ['error', 'never'],
			'@stylistic/array-element-newline': ['error', { multiline: true, minItems: 3 }],
			'@stylistic/object-curly-newline': ['error', {
				ImportDeclaration: { minProperties: 2 },
				ExportDeclaration: { minProperties: 2 },
				ObjectExpression: { multiline: true },
				ObjectPattern: { multiline: true },
			}],
			'@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
			'@stylistic/brace-style': ['error', '1tbs'],
			'@stylistic/block-spacing': ['error', 'always'],
			'@stylistic/spaced-comment': ['error', 'always'],
			'@stylistic/space-in-parens': ['error', 'always'],
		},
	},
]

/**
 * Node config — adds Node.js globals (process, __dirname, Buffer, etc.).
 * Spread after `base` when linting scripts or server-side code.
 */
import globals from 'globals'

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
]

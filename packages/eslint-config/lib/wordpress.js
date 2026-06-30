/**
 * WordPress config — rules for Gutenberg block development and WordPress projects.
 * Uses @wordpress/eslint-plugin's recommended flat config preset, which includes
 * React, JSX, accessibility, i18n, and WordPress-specific API rules.
 * Spread after `base` in your eslint.config.js.
 */
import wordpress from '@wordpress/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
	...wordpress.configs.recommended,
	{
		rules: {
			// @wordpress/* packages are webpack externals provided by WordPress at runtime,
			// not resolvable from node_modules in a custom config context.
			'import/no-unresolved': [ 'error', { ignore: [ '^@wordpress/' ] } ],
			'import/no-extraneous-dependencies': 'off',
			'jsdoc/require-param': 'off',
			'prettier/prettier': 'off',
		},
	},
];

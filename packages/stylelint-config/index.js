// CommonJS required: stylelint's config loader does not support ESM
'use strict';

/** @type {import('stylelint').Config} */
module.exports = {
	plugins: ['@stylistic/stylelint-plugin'],
	extends: ['stylelint-config-standard'],
	overrides: [
		{
			files: ['**/*.scss'],
			extends: ['stylelint-config-standard-scss'],
		},
	],
	rules: {
		'@stylistic/function-parentheses-space-inside': 'always',
		'declaration-no-important': true,
		'declaration-empty-line-before': null,
		'no-unknown-animations': true,
		'scss/double-slash-comment-empty-line-before': [
			'always',
			{
				except: [],
				ignore: ['between-comments', 'stylelint-commands'],
			},
		],
		'@stylistic/color-hex-case': 'lower',
		'@stylistic/unit-case': 'lower',
		'@stylistic/property-case': 'lower',
		'@stylistic/declaration-colon-newline-after': 'always-multi-line',
		'@stylistic/value-list-max-empty-lines': 0,
		'@stylistic/number-leading-zero': 'always',
		'property-layout-mappings': [
			'flow-relative',
			{
				severity: 'warning',
				ignoreProperties: [
					'width',
					'height',
					'min-width',
					'max-width',
					'min-height',
					'max-height'
				]
			}
		],
		'scss/selector-no-redundant-nesting-selector': true,
		'selector-class-pattern': [
			'^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
			{ message: 'Expected class selector to follow BEM naming' },
		],
		'custom-property-pattern': [
			'^[a-z][a-z0-9]*(-[a-z0-9]+)*(--[a-z0-9]+(-[a-z0-9]+)*)*$',
			{ message: 'Expected custom property to be kebab-case or BEM-like' },
		],
	},
};

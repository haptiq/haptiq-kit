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
		'@stylistic/function-max-empty-lines': 0,
		'@stylistic/function-parentheses-space-inside': 'always-single-line',
		'@stylistic/function-parentheses-newline-inside': 'always-multi-line',
		'@stylistic/number-leading-zero': 'always',
		'@stylistic/number-no-trailing-zeros': true,
		'@stylistic/selector-attribute-brackets-space-inside': 'never',
		'@stylistic/selector-attribute-operator-space-after': 'never',
		'@stylistic/selector-attribute-operator-space-before': 'never',
		'@stylistic/selector-combinator-space-after': 'always',
		'@stylistic/selector-combinator-space-before': 'always',
		'@stylistic/selector-descendant-combinator-no-non-space': true,
		'@stylistic/selector-max-empty-lines': 0,
		'@stylistic/selector-pseudo-class-case': 'lower',
		'@stylistic/selector-pseudo-class-parentheses-space-inside': 'always',
		'@stylistic/selector-pseudo-element-case': 'lower',
		'@stylistic/selector-list-comma-newline-after': 'always',
		'@stylistic/selector-list-comma-newline-before': 'never-multi-line',
		'@stylistic/selector-list-comma-space-after': 'always-single-line',
		'@stylistic/selector-list-comma-space-before': 'never',
		'@stylistic/media-feature-colon-space-after': 'always',
		'@stylistic/media-feature-colon-space-before': 'never',
		'@stylistic/media-feature-name-case': 'lower',
		'@stylistic/media-feature-parentheses-space-inside': 'always',
		'@stylistic/media-feature-range-operator-space-after': 'always',
		'@stylistic/media-feature-range-operator-space-before': 'always',
		'@stylistic/media-query-list-comma-newline-after': 'always-multi-line',
		'@stylistic/media-query-list-comma-newline-before': 'never-multi-line',
		'@stylistic/media-query-list-comma-space-after': 'always-single-line',
		'@stylistic/media-query-list-comma-space-before': 'never',
		'@stylistic/indentation': 'tab',
		'@stylistic/max-empty-lines': 2,
		'@stylistic/no-multiple-whitespaces': true,
		'@stylistic/no-extra-semicolons': true,
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
					'max-height',
					'border-top',
					'border-right',
					'border-bottom',
					'border-left',
					'top',
					'right',
					'bottom',
					'left'
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

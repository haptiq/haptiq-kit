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
	},
};

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
	},
};

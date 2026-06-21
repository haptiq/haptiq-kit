// CommonJS required: stylelint's config loader does not support ESM
'use strict';

/**
 * WordPress stylelint preset — enforces WordPress CSS/SCSS coding standards
 * with stylistic rules (indentation, spacing) for theme and block development.
 *
 * Usage: extends: ['@haptiq/stylelint-config/wordpress']
 *
 * @type {import('stylelint').Config}
 */
module.exports = {
	extends: ['@wordpress/stylelint-config/scss-stylistic'],
};

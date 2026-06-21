/**
 * @haptiq/eslint-config
 *
 * Composable ESLint 9 flat config presets for Haptiq projects.
 * Combine the exports that match your project type in eslint.config.js:
 *
 * @example
 * // Browser project
 * import { base } from '@haptiq/eslint-config'
 * export default [...base]
 *
 * @example
 * // WordPress / Gutenberg project
 * import { base, wordpress } from '@haptiq/eslint-config'
 * export default [...base, ...wordpress]
 *
 * @example
 * // Node.js script
 * import { base, node } from '@haptiq/eslint-config'
 * export default [...base, ...node]
 *
 * @module
 */

/** Base rules: js recommended + browser globals + no-console warn + no-unused-vars error */
export { default as base } from './lib/base.js'

/** WordPress rules: @wordpress/eslint-plugin recommended (React, JSX, a11y, i18n, WP APIs) */
export { default as wordpress } from './lib/wordpress.js'

/** Node rules: adds Node.js globals (process, __dirname, etc.) */
export { default as node } from './lib/node.js'

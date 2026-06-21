#!/usr/bin/env node

/**
 * Haptiq Kit CLI
 *
 * Main entry point for the @haptiq/kit build tools.
 * Provides commands for CSS/SCSS processing with optional configuration.
 *
 * Usage:
 *   npx @haptiq/kit css --verbose      # If installed as dependency
 *   npm run kit css --verbose         # If added to package.json scripts
 *   kit css --verbose                 # If installed globally
 *
 * Configuration:
 *   Optional haptiq.config.js file in project root
 */

import { Command } from 'commander';
import { pathToFileURL } from 'url';
import path from 'path';
import packageJson from '../package.json' with { type: 'json' };
import { buildCSS } from '../lib/css.js';
import { buildJS } from '../lib/js.js';

const { version } = packageJson;

const program = new Command();


/**
 * Load and validate configuration from haptiq.config.js
 *
 * Attempts to load configuration from the current working directory.
 * Falls back to empty object if no config file exists.
 * Validates config structure to prevent malicious configurations.
 *
 * @param {boolean} verbose - Show info message when no config found
 * @returns {Promise<Object>} Configuration object or empty object
 */
async function loadConfig(verbose = false) {
	try {
		const configPath = path.join(process.cwd(), 'haptiq.config.js');
		const configModule = await import(pathToFileURL(configPath).href);
		const config = configModule.default;

		// Validate config is a plain object
		if (!config || typeof config !== 'object' || Array.isArray(config)) {
			throw new Error('Configuration must export a plain object');
		}

		// Validate css config structure if present
		if (config.css) {
			if (typeof config.css !== 'object' || Array.isArray(config.css)) {
				throw new Error('css configuration must be an object');
			}

			// Validate critical fields
			if (config.css.src && typeof config.css.src !== 'string') {
				throw new Error('css.src must be a string');
			}

			if (config.css.dest && typeof config.css.dest !== 'string') {
				throw new Error('css.dest must be a string');
			}
		}

		// Validate js config structure if present
		if (config.js) {
			if (typeof config.js !== 'object' || Array.isArray(config.js)) {
				throw new Error('js configuration must be an object');
			}

			// Validate critical fields
			if (config.js.src && typeof config.js.src !== 'string') {
				throw new Error('js.src must be a string');
			}

			if (config.js.dest && typeof config.js.dest !== 'string') {
				throw new Error('js.dest must be a string');
			}
		}

		return config;
	} catch (configError) {
		// ERR_MODULE_NOT_FOUND is the ESM equivalent of MODULE_NOT_FOUND
		if (configError.code === 'ERR_MODULE_NOT_FOUND' || configError.code === 'MODULE_NOT_FOUND') {
			if (verbose) {
				console.log('ℹ️  No haptiq.config.js found, using defaults');
			}
			return {};
		}

		// Re-throw validation errors but sanitize the message
		throw new Error(`Configuration error: ${configError.message}`);
	}
}


/**
 * Create a standardized command handler
 *
 * Wraps task functions with consistent error handling and config loading.
 * Ensures all commands follow the same execution pattern.
 *
 * @param {string} taskName - Human-readable name for error messages
 * @param {Function} taskFunction - Async function that performs the task
 * @returns {Function} Command handler function for commander.js
 */
function createCommandHandler(taskName, taskFunction) {
	return async (options) => {
		try {
			const config = await loadConfig(options.verbose);
			await taskFunction(config, options);
		} catch (error) {
			console.error(`❌ ${taskName} failed:`, error.message);
			process.exit(1);
		}
	};
}


program
	.name('kit')
	.description('Internal build tools for Haptiq projects.')
	.version(version);

program
	.command('css')
	.description('Build CSS from Sass and CSS files')
	.option('--verbose', 'Show detailed output for each file processed')
	.action(createCommandHandler('CSS build', async (config, options) => {
		await buildCSS(config, options.verbose);
	}));

program
	.command('js')
	.description('Bundle JavaScript files with Terser')
	.option('--verbose', 'Show detailed output for bundling process')
	.option('--only <name>', 'Only run the named configuration')
	.option('--skip <name>', 'Skip the named configuration')
	.action(createCommandHandler('JavaScript build', async (config, options) => {
		await buildJS(config, options.verbose, { only: options.only, skip: options.skip });
	}));

program.parse();

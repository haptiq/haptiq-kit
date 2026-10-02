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
 *   kit css --watch                   # Rebuild on every change
 *   kit                               # Build css + js, then watch both
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
import { ship } from '../lib/ship.js';
import { bumpVersion } from '../lib/version.js';
import { startWatch } from '../lib/watch.js';

const { version } = packageJson;

const program = new Command();

// Watch root when neither css.watch nor js.watch is configured
const DEFAULT_WATCH_DIR = 'src';


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

			if (config.css.watch !== undefined && (typeof config.css.watch !== 'string' || config.css.watch.trim() === '')) {
				throw new Error('css.watch must be a non-empty string');
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

			if (config.js.watch !== undefined && (typeof config.js.watch !== 'string' || config.js.watch.trim() === '')) {
				throw new Error('js.watch must be a non-empty string');
			}
		}

		// Validate ship config structure if present
		if (config.ship) {
			if (typeof config.ship !== 'object' || Array.isArray(config.ship)) {
				throw new Error('ship configuration must be an object');
			}

			if (config.ship.src !== undefined && (typeof config.ship.src !== 'string' || config.ship.src.trim() === '')) {
				throw new Error('ship.src must be a non-empty string');
			}

			if (config.ship.exclude !== undefined && !Array.isArray(config.ship.exclude)) {
				throw new Error('ship.exclude must be an array');
			}

			if (config.ship.targets) {
				if (typeof config.ship.targets !== 'object' || Array.isArray(config.ship.targets)) {
					throw new Error('ship.targets must be an object');
				}

				for (const [targetName, targetConfig] of Object.entries(config.ship.targets)) {
					if (targetConfig.dest && typeof targetConfig.dest !== 'string') {
						throw new Error(`ship.targets.${targetName}.dest must be a string`);
					}
					if (targetConfig.host && typeof targetConfig.host !== 'string') {
						throw new Error(`ship.targets.${targetName}.host must be a string`);
					}
					if (targetConfig.dev !== undefined && typeof targetConfig.dev !== 'boolean') {
						throw new Error(`ship.targets.${targetName}.dev must be a boolean (true or false, not a string)`);
					}
					if (targetConfig.zip !== undefined && typeof targetConfig.zip !== 'string') {
						throw new Error(`ship.targets.${targetName}.zip must be a string`);
					}
					if (targetConfig.zip && targetConfig.host) {
						throw new Error(`ship.targets.${targetName}: "zip" and "host" are mutually exclusive`);
					}
					if (targetConfig.zip && targetConfig.dest) {
						throw new Error(`ship.targets.${targetName}: "zip" and "dest" are mutually exclusive`);
					}
				}
			}
		}

		// Validate version config structure if present
		if (config.version) {
			if (typeof config.version !== 'object' || Array.isArray(config.version)) {
				throw new Error('version configuration must be an object');
			}

			if (config.version.files !== undefined) {
				if (!Array.isArray(config.version.files)) {
					throw new Error('version.files must be an array');
				}

				const validTypes = ['plugin-header', 'style-header', 'stable-tag', 'php-constant'];

				for (const [i, entry] of config.version.files.entries()) {
					if (!entry.path || typeof entry.path !== 'string') {
						throw new Error(`version.files[${i}].path must be a non-empty string`);
					}
					if (!entry.type || !validTypes.includes(entry.type)) {
						throw new Error(`version.files[${i}].type must be one of: ${validTypes.join(', ')}`);
					}
					if (entry.type === 'php-constant' && !entry.constant) {
						throw new Error(`version.files[${i}]: "constant" field is required for type "php-constant"`);
					}
				}
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
	return async (...args) => {
		const options = args[args.length - 2];
		const positionalArgs = args.slice(0, -2);
		try {
			const config = await loadConfig(options.verbose);
			await taskFunction(config, options, ...positionalArgs);
		} catch (error) {
			console.error(`❌ ${taskName} failed:`, error.message);
			process.exit(1);
		}
	};
}


/**
 * Describe the CSS watcher
 *
 * The rebuild re-runs the very same invocation that started the watch, so
 * `--only` / `--skip` / `--dev` keep applying and partials (which map to no
 * output of their own) correctly trigger a full rebuild.
 *
 * @param {Object} config - Loaded configuration object
 * @param {boolean} verbose - Show detailed output on each rebuild
 * @param {{ only?: string, skip?: string, dev?: boolean }} runOptions - Build options to reuse
 * @returns {Object} Watcher descriptor for startWatch
 */
function cssWatcher(config, verbose, runOptions) {
	return {
		label: 'CSS',
		dir: config.css?.watch ?? DEFAULT_WATCH_DIR,
		extensions: ['.scss', '.sass', '.css'],
		run: () => buildCSS(config, verbose, runOptions)
	};
}


/**
 * Describe the JavaScript watcher
 *
 * @param {Object} config - Loaded configuration object
 * @param {boolean} verbose - Show detailed output on each rebuild
 * @param {{ only?: string, skip?: string, dev?: boolean }} runOptions - Build options to reuse
 * @returns {Object} Watcher descriptor for startWatch
 */
function jsWatcher(config, verbose, runOptions) {
	return {
		label: 'JavaScript',
		dir: config.js?.watch ?? DEFAULT_WATCH_DIR,
		extensions: ['.js'],
		run: () => buildJS(config, verbose, runOptions)
	};
}


program
	.name('kit')
	.description('Internal build tools for Haptiq projects.')
	.version(version)
	// Options for bare `kit` (see the program action at the bottom of this file)
	.option('--dev', 'Build without minification')
	.option('--verbose', 'Show detailed output')
	// Keeps the program's own --dev/--verbose from swallowing the identically
	// named options of the subcommands: with positional options, flags after a
	// subcommand name always belong to that subcommand.
	.enablePositionalOptions();

program
	.command('css')
	.description('Build CSS from Sass and CSS files')
	.option('--dev', 'Build without minification')
	.option('--verbose', 'Show detailed output for each file processed')
	.option('--only <name>', 'Only run the named configuration')
	.option('--skip <name>', 'Skip the named configuration')
	.option('--watch', 'Rebuild whenever a watched CSS source changes')
	.action(createCommandHandler('CSS build', async (config, options) => {
		const runOptions = { only: options.only, skip: options.skip, dev: options.dev };
		await buildCSS(config, options.verbose, runOptions);

		if (options.watch) {
			await startWatch([cssWatcher(config, options.verbose, runOptions)], { verbose: options.verbose });
		}
	}));

program
	.command('js')
	.description('Bundle JavaScript files with Terser')
	.option('--dev', 'Build without minification')
	.option('--verbose', 'Show detailed output for bundling process')
	.option('--only <name>', 'Only run the named configuration')
	.option('--skip <name>', 'Skip the named configuration')
	.option('--watch', 'Rebuild whenever a watched JavaScript source changes')
	.action(createCommandHandler('JavaScript build', async (config, options) => {
		const runOptions = { only: options.only, skip: options.skip, dev: options.dev };
		await buildJS(config, options.verbose, runOptions);

		if (options.watch) {
			await startWatch([jsWatcher(config, options.verbose, runOptions)], { verbose: options.verbose });
		}
	}));

program
	.command('ship [target]')
	.description('Build assets and ship to remote server via rsync')
	.option('--dev', 'Build without minification before shipping')
	.option('--verbose', 'Show detailed output')
	.action(createCommandHandler('Ship', async (config, options, target) => {
		await ship(config, options.verbose, { target, dev: options.dev });
	}));

program
	.command('version [bump]')
	.description('Bump the project version in package.json and configured files')
	.option('--force', 'Write an explicit version even if it is not valid semver')
	.action(createCommandHandler('Version bump', async (config, options, bump) => {
		await bumpVersion(config, bump ?? 'patch', options.force);
	}));

// Bare `kit` — build everything, then watch everything. `kit --help` still works.
program
	.action(createCommandHandler('Build', async (config, options) => {
		const runOptions = { dev: options.dev };

		await buildCSS(config, options.verbose, runOptions);
		await buildJS(config, options.verbose, runOptions);

		await startWatch(
			[cssWatcher(config, options.verbose, runOptions), jsWatcher(config, options.verbose, runOptions)],
			{ verbose: options.verbose }
		);
	}));

program.parse();

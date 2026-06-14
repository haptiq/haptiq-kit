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

const { Command } = require('commander');
const { version } = require('../package.json');
const { buildCSS } = require('../lib/css');
const path = require('path');

const program = new Command();


/**
 * Load and validate configuration from haptiq.config.js
 * 
 * Attempts to load configuration from the current working directory.
 * Falls back to empty object if no config file exists.
 * Validates config structure to prevent malicious configurations.
 * 
 * @param {boolean} verbose - Show info message when no config found
 * @returns {Object} Configuration object or empty object
 */
function loadConfig(verbose = false) {
	try {
		const configPath = path.join(process.cwd(), 'haptiq.config.js');
		const config = require(configPath);
		
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
		
		return config;
	} catch (configError) {
		// Don't expose internal file paths in error messages
		if (configError.message.includes('Cannot find module')) {
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
			const config = loadConfig(options.verbose);
			await taskFunction(config, options);
		} catch (error) {
			console.error(`❌ ${taskName} failed:`, error.message);
			process.exit(1);
		}
	};
}


/*
 * CLI Setup and Commands
 * 
 * Using Commander.js to define the CLI interface. Each command follows
 * the same pattern: description, options, and action handler wrapped
 * with createCommandHandler for consistent error handling.
 * 
 * To add new commands:
 * 1. Define the command with program.command('name')
 * 2. Add description and any options
 * 3. Wrap action with createCommandHandler(taskName, asyncFunction)
 */

/*
 * Configure the main program
 * Sets the command name users will invoke and provides help text
 */
program
	.name('kit')
	.description('Internal build tools for Haptiq projects.')
	.version(version);

/*
 * CSS Build Command
 * Processes SCSS, Sass, and CSS files through two-stage pipeline:
 * 1. Sass compilation (SCSS/Sass → CSS)
 * 2. LightningCSS optimization (autoprefixing, minification, source maps)
 */
program
	.command('css')
	.description('Build CSS from Sass and CSS files')
	.option('--verbose', 'Show detailed output for each file processed')
	.action(createCommandHandler('CSS build', async (config, options) => {
		await buildCSS(config, options.verbose);
	}));

/*
 * Parse command line arguments and execute the appropriate command
 * This must be called last to process the CLI input
 */
program.parse();
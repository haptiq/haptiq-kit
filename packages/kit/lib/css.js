/**
 * CSS Build Module
 *
 * Handles compilation and processing of SCSS, Sass, and CSS files
 * using a two-stage pipeline: Sass compilation → LightningCSS optimization
 */
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import * as sass from 'sass';
import { transform, browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import haptiqBrowserslistConfig from '@haptiq/browserslist-config';


/**
 * Main CSS build function that processes SCSS, Sass, and CSS files
 *
 * Workflow:
 * 1. SCSS/Sass files: Compile to CSS → Process with LightningCSS
 * 2. CSS files: Process directly with LightningCSS
 * 3. Output: Minified CSS + source maps
 *
 * @param {Object} config - Configuration object from haptiq.config.js
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {Promise<void>}
 * @see {@link ../examples/haptiq.config.js} for all available options
 */
async function buildCSS(config = {}, verbose = false, dev = false) {
	// Use project's own browserslist config if present, otherwise fall back to @haptiq/browserslist-config
	const projectConfig = browserslist.loadConfig({ path: process.cwd() });
	const resolvedTargets = browserslistToTargets(
		browserslist(projectConfig ?? haptiqBrowserslistConfig, { path: process.cwd() })
	);

	const defaultLightningConfig = {
		targets: resolvedTargets,
		minify: !dev,
		sourceMap: true
	};

	const cssConfig = {
		src: 'src/**/*.{scss,sass,css}',
		dest: 'css',
		...config.css,
		// Merge lightning config properly (after user config)
		lightning: {
			...defaultLightningConfig,
			...config.css?.lightning
		}
	};

	const projectRoot = process.cwd();

	if (typeof cssConfig.src !== 'string') {
		throw new Error('Source pattern must be a string');
	}

	if (path.isAbsolute(cssConfig.src) || cssConfig.src.startsWith('~')) {
		throw new Error('Source pattern must be a relative path');
	}

	if (cssConfig.src.includes('..')) {
		throw new Error('Source pattern must not contain path traversal sequences (..)');
	}

	// Ensure destination stays within project boundaries to prevent path traversal
	const safeDest = path.resolve(projectRoot, cssConfig.dest);

	if (safeDest !== projectRoot && !safeDest.startsWith(projectRoot + path.sep)) {
		throw new Error(`Destination path "${cssConfig.dest}" must be within project directory`);
	}

	cssConfig.dest = path.relative(projectRoot, safeDest);

	if (verbose) {
		console.log('🪄 CSS processing begins.');
	}

	const allFiles = globSync(cssConfig.src, { cwd: process.cwd() });

	// Limit file count to prevent resource exhaustion
	const MAX_FILES = 100;
	if (allFiles.length > MAX_FILES) {
		throw new Error(`Too many files found (${allFiles.length}). Maximum allowed: ${MAX_FILES}`);
	}

	const scssFiles = allFiles.filter(f => f.endsWith('.scss'));
	const sassFiles = allFiles.filter(f => f.endsWith('.sass'));
	const cssFiles = allFiles.filter(f => f.endsWith('.css'));

	const sassSourceFiles = [...scssFiles, ...sassFiles];
	const totalFiles = sassSourceFiles.length + cssFiles.length;

	if (totalFiles === 0) {
		console.log('ℹ️  No CSS/SCSS files found');
		return;
	}

	if (verbose) {
		console.log(`📦 Found ${sassSourceFiles.length} SCSS/Sass and ${cssFiles.length} CSS files to process`);
	}

	// Stage 1: SCSS/Sass → compile + post-process
	for (const file of sassSourceFiles) {
		await processSingleSassFile(file, cssConfig, verbose);
	}

	// Stage 2: pure CSS → post-process only
	for (const file of cssFiles) {
		await processSingleCSSFile(file, cssConfig, verbose);
	}

	console.log(`✅ ${totalFiles} CSS files were created.`);
}


/**
 * Process a single SCSS or Sass file
 *
 * Pipeline:
 * 1. Sass compilation → Raw CSS
 * 2. LightningCSS processing → Minified CSS + source maps
 *
 * @param {string} file - Path to the SCSS/Sass file
 * @param {Object} cssConfig - CSS configuration object
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {Promise<void>}
 */
async function processSingleSassFile(file, cssConfig, verbose = false) {
	try {
		// Limit file size to prevent memory exhaustion during processing
		const stats = fs.statSync(file);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
		}

		/*
		 * Sass Compilation Configuration
		 * Use expanded style for better Lightning CSS processing
		 * Let Lightning handle source maps for consistency
		 */
		const sassOptions = {
			...cssConfig.sass,   // Pass through user sass config
			style: 'expanded',  // Output readable CSS for Lightning to process
			sourceMap: false   // Lightning will handle source maps
		};

		const result = sass.compile(file, sassOptions);
		await processWithLightning(result.css, file, cssConfig, verbose);

	} catch (error) {
		// Use basename to avoid exposing internal file paths in error messages
		const fileName = path.basename(file);
		throw new Error(`Sass compilation failed for ${fileName}: ${error.message}`);
	}
}


/**
 * Process a single CSS file through LightningCSS
 *
 * For pure CSS files, skip Sass compilation and go directly to post-processing
 *
 * @param {string} file - Path to the CSS file
 * @param {Object} cssConfig - CSS configuration object
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {Promise<void>}
 */
async function processSingleCSSFile(file, cssConfig, verbose = false) {
	try {
		// Limit file size to prevent memory exhaustion during processing
		const stats = fs.statSync(file);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
		}

		const css = fs.readFileSync(file, 'utf8');
		await processWithLightning(css, file, cssConfig, verbose);

	} catch (error) {
		// Use basename to avoid exposing internal file paths in error messages
		const fileName = path.basename(file);
		throw new Error(`CSS processing failed for ${fileName}: ${error.message}`);
	}
}


/**
 * Process CSS content through LightningCSS for optimization
 *
 * LightningCSS provides:
 * - Autoprefixing for browser compatibility
 * - Minification for smaller file sizes
 * - Modern CSS transpilation
 * - Source map generation
 *
 * @param {string} cssContent - Raw CSS content to process
 * @param {string} file - Original file path (for source maps)
 * @param {Object} cssConfig - CSS configuration object
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {void}
 */
function processWithLightning(cssContent, file, cssConfig, verbose) {
	const result = transform({
		...cssConfig.lightning,
		code: Buffer.from(cssContent),
		filename: file
	});

	// Convert .scss/.sass extension to .css for the output file
	const fileName = file.endsWith('.css')
		? path.basename(file)
		: path.basename(file, path.extname(file)) + '.css';
	const outputPath = path.join(cssConfig.dest, fileName);

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });

	// Check write permissions before attempting the write to surface a clear error
	try {
		fs.accessSync(path.dirname(outputPath), fs.constants.W_OK);
	} catch {
		throw new Error(`Cannot write to directory: ${path.dirname(outputPath)}. Check permissions.`);
	}

	fs.writeFileSync(outputPath, result.code);

	if (result.map && cssConfig.lightning?.sourceMap) {
		fs.writeFileSync(`${outputPath}.map`, result.map.toString());
	}

	if (verbose) {
		console.log(`  ✅ ${file} → ${outputPath}`);
	}
}


export { buildCSS };

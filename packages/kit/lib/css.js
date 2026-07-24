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
 * Supports both a single configuration and multiple named configurations.
 * See examples in ../examples/haptiq.config.js
 *
 * @param {Object} config - Configuration object from haptiq.config.js
 * @param {boolean} verbose - Show detailed processing logs
 * @param {{ only?: string, skip?: string, dev?: boolean }} options - CLI filter options
 * @returns {Promise<void>}
 * @see {@link ../examples/haptiq.config.js} for all available options
 */
async function buildCSS(config = {}, verbose = false, options = {}) {
	const dev = options.dev ?? false;
	const cssConfig = config.css || {};

	// Use project's own browserslist config if present, otherwise fall back to @haptiq/browserslist-config
	const projectConfig = browserslist.loadConfig({ path: process.cwd() });
	const resolvedTargets = browserslistToTargets(
		browserslist(projectConfig ?? haptiqBrowserslistConfig, { path: process.cwd() })
	);

	if (verbose) {
		console.log('🪄 CSS processing begins.');
	}

	let processed = 0;
	let empty = 0;

	if (cssConfig.configs !== undefined) {
		const configNames = Object.keys(cssConfig.configs);
		let configsToProcess = configNames;

		if (options.only) {
			configsToProcess = configNames.filter(name => name === options.only);
			if (configsToProcess.length === 0) {
				throw new Error(`Configuration "${options.only}" not found. Available: ${configNames.join(', ')}`);
			}
		}

		if (options.skip) {
			configsToProcess = configsToProcess.filter(name => name !== options.skip);
		}

		if (verbose) {
			console.log(`📦 Processing ${configsToProcess.length} CSS configurations: ${configsToProcess.join(', ')}`);
		}

		for (const name of configsToProcess) {
			const result = await processSingleConfig(cssConfig.configs[name], resolvedTargets, verbose, dev);
			processed += result.processed;
			empty += result.empty;
			if (verbose) {
				console.log(`  ✅ [${name}] done`);
			}
		}
	} else {
		if (options.only || options.skip) {
			console.warn('⚠️  --only and --skip have no effect with a single configuration');
		}
		({ processed, empty } = await processSingleConfig(cssConfig, resolvedTargets, verbose, dev));
	}

	if (processed === 0 && empty === 0) {
		console.log('ℹ️  No CSS/SCSS files found');
		return;
	}

	let summary = `✅ ${processed} CSS files processed.`;
	if (empty > 0) {
		summary += ` ${empty} empty file${empty === 1 ? '' : 's'} ignored.`;
	}
	console.log(summary);
}


/**
 * Process a single CSS configuration
 *
 * @param {Object} rawConfig - A single CSS config (src/dest/sass/lightning)
 * @param {Object} resolvedTargets - LightningCSS browser targets
 * @param {boolean} verbose - Show detailed processing logs
 * @param {boolean} dev - Skip minification (--dev flag)
 * @returns {Promise<number>} Number of files created
 */
async function processSingleConfig(rawConfig, resolvedTargets, verbose, dev) {
	const defaultLightningConfig = {
		targets: resolvedTargets,
		minify: !dev,
		sourceMap: true
	};

	const cssConfig = {
		dest: 'css',
		...rawConfig,
		lightning: {
			...defaultLightningConfig,
			...rawConfig?.lightning,
			...(dev && { minify: false })
		}
	};

	const projectRoot = process.cwd();

	// No src configured — auto-detect a conventional source directory inside src/
	// (styles, scss, …) and use it as the base, so its files map straight into dest
	// without an extra nested folder. Falls back to scanning all of src/.
	if (cssConfig.src === undefined) {
		cssConfig.src = resolveDefaultSrc(projectRoot, verbose);
	}

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

	// A dest ending in a file extension (and not a trailing slash) targets one
	// specific output file rather than a directory — used to rename output.
	const destIsFile = !cssConfig.dest.endsWith('/') && path.extname(cssConfig.dest) !== '';

	// Ignore Sass partials (leading underscore); they are only ever @use/@import-ed,
	// never compiled to standalone CSS. Matches Dart Sass' own convention.
	const allFiles = globSync(cssConfig.src, { cwd: process.cwd(), ignore: '**/_*.{scss,sass}' });

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
		return { processed: 0, empty: 0 };
	}

	// A single-file dest can only receive one compiled file — CSS has no bundling.
	if (destIsFile && totalFiles > 1) {
		throw new Error(`Destination "${cssConfig.dest}" is a single file but ${totalFiles} source files matched. Use a directory dest, or narrow the src pattern to one file.`);
	}

	if (verbose) {
		console.log(`📦 Found ${sassSourceFiles.length} SCSS/Sass and ${cssFiles.length} CSS files to process`);
	}

	let processed = 0;
	let empty = 0;

	// Stage 1: SCSS/Sass → compile + post-process
	for (const file of sassSourceFiles) {
		if (await processSingleSassFile(file, cssConfig, verbose, destIsFile)) processed++;
		else empty++;
	}

	// Stage 2: pure CSS → post-process only
	for (const file of cssFiles) {
		if (await processSingleCSSFile(file, cssConfig, verbose, destIsFile)) processed++;
		else empty++;
	}

	return { processed, empty };
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
 * @param {boolean} destIsFile - dest targets one specific output file
 * @returns {Promise<void>}
 */
async function processSingleSassFile(file, cssConfig, verbose = false, destIsFile = false) {
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
		return processWithLightning(result.css, file, cssConfig, verbose, destIsFile);

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
 * @param {boolean} destIsFile - dest targets one specific output file
 * @returns {Promise<void>}
 */
async function processSingleCSSFile(file, cssConfig, verbose = false, destIsFile = false) {
	try {
		// Limit file size to prevent memory exhaustion during processing
		const stats = fs.statSync(file);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
		}

		const css = fs.readFileSync(file, 'utf8');
		return processWithLightning(css, file, cssConfig, verbose, destIsFile);

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
 * @param {boolean} destIsFile - dest targets one specific output file
 * @returns {boolean} Whether an output file was written (false = skipped as empty)
 */
function processWithLightning(cssContent, file, cssConfig, verbose, destIsFile = false) {
	const result = transform({
		...cssConfig.lightning,
		code: Buffer.from(cssContent),
		filename: file
	});

	// A source that compiles to no meaningful CSS (e.g. a placeholder partial with
	// only comments, which minification strips) would produce an empty file that
	// then gets loaded for nothing. Skip the write; the count is reported at the end.
	if (result.code.toString().trim() === '') {
		if (verbose) {
			console.warn(`  ⚠️ ${file} produced empty CSS — nothing written`);
		}
		return false;
	}

	let outputPath;
	if (destIsFile) {
		// dest is an explicit output file — write there verbatim (allows renaming)
		outputPath = cssConfig.dest;
	} else {
		// Convert .scss/.sass extension to .css for the output file
		const fileName = file.endsWith('.css')
			? path.basename(file)
			: path.basename(file, path.extname(file)) + '.css';

		// Mirror the source folder structure relative to the glob's static base,
		// so src/scss/blocks/foo.scss → <dest>/blocks/foo.css
		const base = getGlobBase(cssConfig.src);
		const relDir = path.dirname(path.relative(base, file));
		outputPath = path.join(cssConfig.dest, relDir, fileName);
	}

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

	return true;
}


/**
 * Resolve the default src glob when none is configured.
 *
 * Prefers a conventional source directory inside src/ so its contents map
 * directly into dest (e.g. src/styles/main.scss → css/main.css instead of
 * css/styles/main.css). Precedence, most-conventional first, ambiguous last:
 * styles → scss → sass → style → css. Falls back to all of src/.
 *
 * @param {string} projectRoot - Absolute project directory
 * @param {boolean} verbose - Show which pattern was auto-detected
 * @returns {string} A relative glob pattern
 */
function resolveDefaultSrc(projectRoot, verbose) {
	const candidates = ['styles', 'scss', 'sass', 'style', 'css'];

	for (const dir of candidates) {
		const candidatePath = path.join(projectRoot, 'src', dir);
		if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
			const pattern = `src/${dir}/**/*.{scss,sass,css}`;
			if (verbose) {
				console.log(`🔍 No src configured — using ${pattern}`);
			}
			return pattern;
		}
	}

	return 'src/**/*.{scss,sass,css}';
}


/**
 * Extract the static base directory from a glob pattern
 */
function getGlobBase(pattern) {
	const parts = pattern.split('/');
	const firstWild = parts.findIndex(p => /[*?{[]/.test(p));
	return firstWild <= 0 ? '.' : parts.slice(0, firstWild).join('/');
}


export { buildCSS };

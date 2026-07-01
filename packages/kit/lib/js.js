/**
 * JavaScript Build Module
 *
 * Handles minification and bundling of JavaScript files using Terser.
 */
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { minify } from 'terser';


/**
 * Main JavaScript build function that processes JS files
 *
 * Supports both single configuration and multiple named configurations:
 * - Single: { src: '...', dest: '...', terser: {...} }
 * - Multiple: { configs: { 'config-name': { src: '...', dest: '...' }, 'other': {...} } }
 *
 * @param {Object} config - Configuration object from haptiq.config.js
 * @param {boolean} verbose - Show detailed processing logs
 * @param {{ only?: string, skip?: string, dev?: boolean }} options - CLI filter options
 * @returns {Promise<void>}
 */
async function buildJS(config = {}, verbose = false, options = {}) {
	const jsConfig = config.js || {};
	const hasMultipleConfigs = jsConfig.configs !== undefined;
	const dev = options.dev ?? false;

	if (hasMultipleConfigs) {
		await processMultipleConfigs(jsConfig.configs, verbose, options, dev);
	} else {
		if (options.only || options.skip) {
			console.warn('⚠️  --only and --skip have no effect with a single configuration');
		}
		await processSingleConfig(jsConfig, verbose, dev);
	}

	console.log(`✅ JavaScript processing completed.`);
}


/**
 * Process multiple named JavaScript configurations
 *
 * @param {Object} configs - Object with named configurations
 * @param {boolean} verbose - Show detailed processing logs
 * @param {{ only?: string, skip?: string, dev?: boolean }} options - CLI filter options
 * @returns {Promise<void>}
 */
async function processMultipleConfigs(configs, verbose, options = {}, dev = false) {
	const configNames = Object.keys(configs);

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
		console.log(`📦 Processing ${configsToProcess.length} JavaScript configurations: ${configsToProcess.join(', ')}`);
	}

	for (const configName of configsToProcess) {
		await processSingleConfig(configs[configName], verbose, dev);
		if (verbose) {
			console.log(`  ✅ [${configName}] done`);
		}
	}
}


/**
 * Process a single JavaScript configuration
 *
 * @param {Object} jsConfig - Single JS configuration object
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {Promise<void>}
 */
async function processSingleConfig(jsConfig, verbose, dev = false) {
	const dest = jsConfig.dest || 'js/bundle.js';
	let combine = jsConfig.combine;
	if (combine === undefined) {
		combine = !dest.endsWith('/') && path.extname(dest) !== '';
	}

	const mergedConfig = {
		...jsConfig,
		src: jsConfig.src || 'src/**/*.js',
		dest,
		combine,
		terser: {
			sourceMap: true,
			...(dev && { compress: false, mangle: false, format: { beautify: true } }),
			...jsConfig.terser
		}
	};

	const projectRoot = process.cwd();

	if (typeof mergedConfig.src !== 'string') {
		throw new Error('Source pattern must be a string');
	}

	if (path.isAbsolute(mergedConfig.src) || mergedConfig.src.startsWith('~')) {
		throw new Error('Source pattern must be a relative path');
	}

	if (mergedConfig.src.includes('..')) {
		throw new Error('Source pattern must not contain path traversal sequences (..)');
	}

	const safeDest = path.resolve(projectRoot, mergedConfig.dest);

	if (safeDest !== projectRoot && !safeDest.startsWith(projectRoot + path.sep)) {
		throw new Error(`Destination path "${mergedConfig.dest}" must be within project directory`);
	}

	mergedConfig.dest = path.relative(projectRoot, safeDest);

	if (verbose) {
		console.log('🪄 JavaScript processing begins.');
	}

	const allFiles = globSync(mergedConfig.src, { cwd: process.cwd() });

	const MAX_FILES = 100;
	if (allFiles.length > MAX_FILES) {
		throw new Error(`Too many files found (${allFiles.length}). Maximum allowed: ${MAX_FILES}`);
	}

	if (allFiles.length === 0) {
		console.log('ℹ️  No JavaScript files found');
		return;
	}

	if (verbose) {
		console.log(`📦 Found ${allFiles.length} JavaScript files to process`);
	}

	await processWithTerser(allFiles, mergedConfig, verbose);
}


/**
 * Process JavaScript files using Terser
 *
 * @param {string[]} files - Array of JS file paths
 * @param {Object} jsConfig - JavaScript configuration object
 * @param {boolean} verbose - Show detailed processing logs
 * @returns {Promise<void>}
 */
async function processWithTerser(files, jsConfig, verbose) {
	try {
		for (const file of files) {
			const stats = fs.statSync(file);
			const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

			if (stats.size > MAX_FILE_SIZE) {
				throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
			}
		}

		if (jsConfig.combine) {
			const outputDir = path.dirname(jsConfig.dest);
			fs.mkdirSync(outputDir, { recursive: true });

			try {
				fs.accessSync(outputDir, fs.constants.W_OK);
			} catch {
				throw new Error(`Cannot write to directory: ${outputDir}. Check permissions.`);
			}

			const inputs = {};
			for (const file of files) {
				inputs[path.basename(file)] = fs.readFileSync(file, 'utf8');
			}

			const sourceMap = jsConfig.terser.sourceMap !== false ? {
				filename: path.basename(jsConfig.dest),
				url: path.basename(jsConfig.dest) + '.map'
			} : false;

			const result = await minify(inputs, { ...jsConfig.terser, sourceMap });

			fs.writeFileSync(jsConfig.dest, result.code);
			if (result.map) {
				fs.writeFileSync(`${jsConfig.dest}.map`, result.map);
			}

			if (verbose) {
				console.log(`  ✅ Combined ${files.length} files → ${jsConfig.dest}`);
			}

		} else {
			const base = getGlobBase(jsConfig.src);
			const outputDir = jsConfig.dest;
			fs.mkdirSync(outputDir, { recursive: true });

			try {
				fs.accessSync(outputDir, fs.constants.W_OK);
			} catch {
				throw new Error(`Cannot write to directory: ${outputDir}. Check permissions.`);
			}

			for (const file of files) {
				const code = fs.readFileSync(file, 'utf8');
				const relativePath = path.relative(base, file);
				const outputPath = path.join(outputDir, relativePath);

				fs.mkdirSync(path.dirname(outputPath), { recursive: true });

				const sourceMap = jsConfig.terser.sourceMap !== false ? {
					filename: path.basename(outputPath),
					url: path.basename(outputPath) + '.map'
				} : false;

				const result = await minify(code, { ...jsConfig.terser, sourceMap });

				fs.writeFileSync(outputPath, result.code);
				if (result.map) {
					fs.writeFileSync(`${outputPath}.map`, result.map);
				}

				if (verbose) {
					console.log(`  ✅ ${file} → ${outputPath}`);
				}
			}
		}

	} catch (error) {
		if (error.filename) {
			const loc = error.line ? ` (${error.line}:${error.col})` : '';
			throw new Error(`Syntax error in ${error.filename}${loc}: ${error.message}`);
		}
		throw new Error(`Terser processing failed: ${error.message}`);
	}
}


/**
 * Extract the static base directory from a glob pattern
 */
function getGlobBase(pattern) {
	const parts = pattern.split('/');
	const firstWild = parts.findIndex(p => /[*?{[]/.test(p));
	return firstWild <= 0 ? '.' : parts.slice(0, firstWild).join('/');
}


export { buildJS };

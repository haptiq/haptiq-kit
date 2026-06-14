/**
 * CSS Build Module
 * 
 * Handles compilation and processing of SCSS, Sass, and CSS files
 * using a two-stage pipeline: Sass compilation → LightningCSS optimization
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');


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
 * @see {@link ../examples/haptiq.config.js} Example configuration file
 */
async function buildCSS(config = {}, verbose = false) {
	/*
	 * Configuration: Merge user config with sensible defaults
	 */
	const defaultLightningConfig = {
		targets: { chrome: 80, firefox: 90, safari: 14 },
		minify: true,
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
	
	if (verbose) {
		console.log('🪄 CSS processing begins.');
	}
	
	/*
	 * Find and categorize all CSS source files
	 */
	const allFiles = glob.sync(cssConfig.src, { cwd: process.cwd() });
	const scssFiles = allFiles.filter(f => f.endsWith('.scss'));
	const sassFiles = allFiles.filter(f => f.endsWith('.sass'));
	const cssFiles = allFiles.filter(f => f.endsWith('.css'));
	
	const sassSourceFiles = [...scssFiles, ...sassFiles];
	const totalFiles = sassSourceFiles.length + cssFiles.length;
	
	// Early exit if no files found
	if (totalFiles === 0) {
		console.log('ℹ️  No CSS/SCSS files found');
		return;
	}
	
	if (verbose) {
		console.log(`📦 Found ${sassSourceFiles.length} SCSS/Sass and ${cssFiles.length} CSS files to process`);
	}
	
	/*
	 * Process files in two stages based on type
	 */
	
	// Stage 1: Process SCSS/Sass files (compile + post-process)
	for (const file of sassSourceFiles) {
		await processSingleSassFile(file, cssConfig, verbose);
	}
	
	// Stage 2: Process pure CSS files (post-process only)
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
 */
async function processSingleSassFile(file, cssConfig, verbose = false) {
	try {
		const sass = require('sass');
		
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
		
		// Pass compiled CSS to Lightning processor
		await processWithLightning(result.css, file, cssConfig, verbose);
		
	} catch (error) {
		// Provide helpful error messages for missing dependencies
		if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('sass')) {
			throw new Error('Sass not found. Install with: npm install sass');
		} else if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('lightningcss')) {
			throw new Error('LightningCSS not found. Install with: npm install lightningcss');
		}
		throw new Error(`Sass compilation failed for ${file}: ${error.message}`);
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
 */
async function processSingleCSSFile(file, cssConfig, verbose = false) {
	try {
		// Read raw CSS content
		const css = fs.readFileSync(file, 'utf8');
		
		// Process directly through Lightning CSS
		await processWithLightning(css, file, cssConfig, verbose);
		
	} catch (error) {
		// Provide helpful error message for missing LightningCSS
		if (error.code === 'MODULE_NOT_FOUND') {
			throw new Error('LightningCSS not found. Install with: npm install lightningcss');
		}
		throw error;
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
 */
async function processWithLightning(cssContent, file, cssConfig, verbose) {
	const { transform } = require('lightningcss');
	
	/*
	 * LightningCSS Transformation
	 * Apply autoprefixing, minification, and modern CSS transforms
	 */
	const result = transform({
		...cssConfig.lightning,  // User configuration overrides
		code: Buffer.from(cssContent),
		filename: file
	});
	
	/*
	 * Output Path Generation
	 * Convert .scss/.sass extensions to .css, preserve .css as-is
	 */
	const fileName = file.endsWith('.css') 
		? path.basename(file)
		: path.basename(file, path.extname(file)) + '.css';
	const outputPath = path.join(cssConfig.dest, fileName);
	
	// Ensure output directory exists
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	
	/*
	 * File Output
	 * Write processed CSS and optional source map
	 */
	fs.writeFileSync(outputPath, result.code);
	
	// Write source map if enabled and generated
	if (result.map && cssConfig.lightning?.sourceMap) {
		fs.writeFileSync(`${outputPath}.map`, result.map.toString());
	}
	
	if (verbose) {
		console.log(`  ✅ ${file} → ${outputPath}`);
	}
}

module.exports = {
	buildCSS,
	processSingleSassFile,
	processSingleCSSFile
};
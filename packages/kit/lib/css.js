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

	/*
	 * Input Validation
	 * Prevent malicious patterns and path traversal attacks
	 */
	const projectRoot = process.cwd();

	// Validate source glob pattern to prevent path traversal
	if (typeof cssConfig.src !== 'string' || cssConfig.src.includes('..')) {
		throw new Error('Source pattern must not contain path traversal sequences (..)');
	}
	
	// Block patterns targeting sensitive system files and directories
	const dangerousPatterns = [
		'/etc/**',
		'/var/**', 
		'/usr/**',
		'/home/**',
		'~/**',
		'**/node_modules/**',
		'**/.git/**',
		'**/.env*'
	];
	
	if (dangerousPatterns.some(pattern => cssConfig.src.includes(pattern))) {
		throw new Error('Source pattern targets potentially sensitive files or directories');
	}

	// Ensure destination stays within project boundaries to prevent path traversal
	const safeDest = path.resolve(projectRoot, cssConfig.dest);
	
	if (!safeDest.startsWith(projectRoot)) {
		throw new Error(`Destination path "${cssConfig.dest}" must be within project directory`);
	}
	
	// Update config with validated path
	cssConfig.dest = path.relative(projectRoot, safeDest);
	
	if (verbose) {
		console.log('🪄 CSS processing begins.');
	}
	
	/*
	 * Find and categorize all CSS source files
	 */
	const allFiles = glob.sync(cssConfig.src, { cwd: process.cwd() });
	
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
		// Limit file size to prevent memory exhaustion during processing
		const stats = fs.statSync(file);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		
		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
		}
		
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
 */
async function processSingleCSSFile(file, cssConfig, verbose = false) {
	try {
		// Limit file size to prevent memory exhaustion during processing
		const stats = fs.statSync(file);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		
		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(`File ${path.basename(file)} is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
		}
		
		// Read raw CSS content
		const css = fs.readFileSync(file, 'utf8');
		
		// Process directly through Lightning CSS
		await processWithLightning(css, file, cssConfig, verbose);
		
	} catch (error) {
		// Provide helpful error message for missing LightningCSS
		if (error.code === 'MODULE_NOT_FOUND') {
			throw new Error('LightningCSS not found. Install with: npm install lightningcss');
		}
		
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
	 * Verify write permissions to prevent cryptic EACCES errors during file writing
	 */
	try {
		fs.accessSync(path.dirname(outputPath), fs.constants.W_OK);
	} catch (permissionError) {
		throw new Error(`Cannot write to directory: ${path.dirname(outputPath)}. Check permissions.`);
	}
	
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
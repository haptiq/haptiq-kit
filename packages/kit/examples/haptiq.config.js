/**
 * Example Haptiq Kit Configuration
 *
 * Copy this file to your project root and customize as needed.
 * All options are optional - defaults will be used if not specified.
 */

module.exports = {
	// CSS Configuration
	css: {
		// Source files pattern (default: 'src/**/*.{scss,sass,css}')
		src: 'src/styles/**/*.{scss,sass,css}',

		// Output directory (default: 'css')
		dest: 'assets/css',

		// Sass compilation options
		sass: {
			style: 'expanded',           // 'expanded' | 'compressed'
			sourceMap: false,            // Let LightningCSS handle source maps
			includePaths: ['node_modules'] // Additional include paths
		},

		// LightningCSS optimization options
		lightning: {
			// Browser targets for autoprefixing
			targets: {
				chrome: 90,
				firefox: 88,
				safari: 14,
				edge: 90
			},

			// Minification (default: true)
			minify: true,

			// Source maps (default: true)
			sourceMap: true,

			// CSS nesting support
			cssNesting: true,

			// Custom media queries
			customMedia: true
		}
	},

	// JavaScript Configuration — combine mode (all files into one output)
	js: {
		// Source files pattern (default: 'src/**/*.js')
		src: 'source/scripts/**/*.js',

		// Output file path — .js extension triggers combine mode (default: 'js/bundle.js')
		// Use a trailing slash or no extension to process files individually
		dest: 'assets/js/bundle.js',

		// Terser minification options (all optional)
		terser: {
			compress: {
				drop_console: true,     // Remove console.* calls
				drop_debugger: true,    // Remove debugger statements
				passes: 2              // Number of compression passes (more = smaller, slower)
			},
			mangle: {
				toplevel: false        // Mangle top-level variable/function names
			},
			format: {
				comments: false        // Strip comments from output
			}
			// Note: sourceMap is handled by the kit, do not set it here
		}
	},

	// JavaScript Configuration — multiple named configs
	// js: {
	//   configs: {
	//     'main-app': {
	//       src: 'src/app/**/*.js',
	//       dest: 'public/js/app.bundle.js',  // .js extension → combine mode
	//     },
	//     'components': {
	//       src: 'src/components/**/*.js',
	//       dest: 'public/js/components/',    // trailing slash → individual files
	//     }
	//   }
	// },

	// Ship Configuration
	// Run: kit ship staging   kit ship prod   kit ship dist
	ship: {
		// Source directory to sync (default: './')
		src: './',

		// Files and directories to exclude from the sync
		exclude: [
			'.DS_Store',
			'.git*',
			'node_modules',
			'scss',
			'src',
			'haptiq.config.js',
			'package.json',
			'package-lock.json',
			// Source maps: remove this line if you use an error monitoring tool
			// (e.g. Sentry) that needs .map files to decode production stack traces
			'*.map',
		],

		// Remove remote files that no longer exist locally (rsync --delete)
		delete: true,

		targets: {
			// `kit ship dist` is always available without any config entry.
			// It outputs to ../project-name-dist/ beside the project folder.
			// Only add a dist entry here if you need to override defaults, e.g.:
			// dist: { dev: true },

			// Staging server — dev: true means assets are always built unminified
			staging: {
				host: 'user@staging.example.com',
				dest: '/path/to/staging/',
				dev: true,
			},

			// Production server — production build (minified)
			prod: {
				host: 'user@example.com',
				dest: '/path/to/live/',
			},
		},
	},
};

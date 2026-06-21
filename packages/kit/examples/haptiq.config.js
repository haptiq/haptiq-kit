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
};

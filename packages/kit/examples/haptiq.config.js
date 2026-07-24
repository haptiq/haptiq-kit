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
		// Sass partials (files with a leading underscore, e.g. _colors.scss) are
		// always ignored — they are only ever @use/@import-ed, never compiled alone.
		src: 'src/styles/**/*.{scss,sass,css}',

		// Output directory (default: 'css')
		// The source folder structure is mirrored under dest relative to the
		// static base of src, so src/styles/blocks/hero.scss → assets/css/blocks/hero.css
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

	// CSS Configuration — multiple named configs
	// Use when different source groups need different output roots or options.
	// Filter with `kit css --only <name>` / `kit css --skip <name>`.
	//
	// NOTE: each named config is self-contained — top-level `sass`/`lightning`
	// options are NOT inherited by the configs. Put per-config options (e.g.
	// `lightning.minify`) inside each config. This also means you can emit the
	// same source twice with different settings (e.g. minified + unminified).
	// css: {
	//   configs: {
	//     // Single-file src + a dest ending in .css writes that exact file (rename).
	//     'main':   { src: 'src/scss/main.scss',    dest: 'assets/css/theme.css' },
	//     // Directory dest mirrors the source tree beneath it.
	//     'root':   { src: 'src/scss/*.scss',        dest: 'assets/css' },
	//     'blocks': { src: 'src/scss/blocks/*.scss', dest: 'assets/css/blocks' },
	//     // Same source, unminified, to a separate file:
	//     'main-dev': { src: 'src/scss/main.scss', dest: 'assets/css/theme.dev.css',
	//                   lightning: { minify: false } },
	//   }
	// },

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

			// Zip archive — {name} and {version} are replaced at build time
			archive: {
				zip: '/path/to/releases/{name}-{version}.zip',
			},
			// Relative path possible as well (this puts it beside project root):
			// archive: {
			//   zip: '../{name}-{version}.zip',
			// },
		},
	},
};

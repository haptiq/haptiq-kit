/**
 * Path Guards
 *
 * Enforces one invariant across the build pipelines:
 * **output is never inside a declared input.**
 *
 * A `dest` inside an input tree makes the build read what it writes — the real
 * sources silently stop being compiled — and makes the watcher rebuild forever.
 *
 * Inputs are declared two ways, so the guard is applied to both: the `src` glob
 * (reduced to the directories it reads from) and the `watch` directories.
 */
import path from 'path';


/**
 * Whether a path lies inside a directory (or is that directory itself)
 *
 * @param {string} childPath - Path to test
 * @param {string} parentDir - Directory it must not be inside
 * @returns {boolean} True when childPath is at or below parentDir
 */
function isInside(childPath, parentDir) {
	const child = path.resolve(childPath);
	const parent = path.resolve(parentDir);

	return child === parent || child.startsWith(parent + path.sep);
}


/**
 * The directories a glob pattern actually reads from
 *
 * The static prefix before the first wildcard segment — one entry per brace
 * alternative, since `assets/{scss,blocks}/**` reads from two separate roots and
 * a single prefix (`assets`) would wrongly include their siblings. A pattern
 * with no wildcard at all names one file, so its directory is the root.
 *
 * Deliberately separate from `getGlobBase()` in css.js/js.js: that one feeds
 * output path mirroring and must keep its current behaviour.
 *
 * @param {string} pattern - Glob pattern (relative to the project root)
 * @returns {string[]} Directories the pattern reads from
 */
function globInputRoots(pattern) {
	const parts = pattern.split('/');
	const firstWild = parts.findIndex(part => /[*?[]/.test(part) || part.includes('{'));

	// No wildcard: the pattern is a single file, so it reads from its directory
	if (firstWild === -1) {
		return [path.dirname(pattern)];
	}

	const prefix = parts.slice(0, firstWild);
	const wildSegment = parts[firstWild];

	// A brace in the first wildcard segment names several roots: expand it so each
	// is checked on its own (assets/{scss,blocks}/** reads assets/scss + assets/blocks,
	// not all of assets).
	const braces = wildSegment.match(/^\{([^{}]+)\}$/);
	if (braces) {
		return braces[1].split(',').map(alt => [...prefix, alt.trim()].join('/'));
	}

	return [prefix.length === 0 ? '.' : prefix.join('/')];
}


/**
 * The directory a destination writes into
 *
 * A `dest` ending in a file extension names one output file, so the directory
 * holding it is what matters for containment.
 *
 * @param {string} dest - Configured destination
 * @returns {string} Directory the output is written into
 */
function destDirectory(dest) {
	const isFile = !dest.endsWith('/') && path.extname(dest) !== '';

	return isFile ? path.dirname(dest) : dest;
}


/**
 * The guard: reject any destination that lies inside a declared input
 *
 * @param {string[]} inputRoots - Directories declared as inputs
 * @param {string[]} dests - Configured destinations for this pipeline
 * @param {string} pipeline - 'css' or 'js', for the error message
 * @param {'src'|'watch'} inputKind - Which input declared the root, for the message
 * @returns {void}
 * @throws {Error} When a destination is inside an input root
 */
function assertOutputOutsideInputs(inputRoots, dests, pipeline, inputKind) {
	for (const root of inputRoots) {
		for (const dest of dests) {
			if (!isInside(destDirectory(dest), root)) {
				continue;
			}

			const consequence = inputKind === 'watch'
				? 'every rebuild would trigger another one'
				: 'the build would read its own output, and edits to the real sources would stop having any effect';

			const remedy = inputKind === 'watch'
				? `Point ${pipeline}.watch at the source directory rather than its parent `
					+ `(e.g. "${root}/scss"), or pass several: watch: ['${root}/scss', '${root}/blocks'].`
				: `Move ${pipeline}.dest outside "${root}", or narrow ${pipeline}.src to the directory `
					+ 'it actually reads from.';

			throw new Error(
				`${pipeline}.dest "${dest}" is inside ${pipeline}.${inputKind} "${root}" — ${consequence}. ${remedy}`
			);
		}
	}
}


export {
	isInside,
	globInputRoots,
	destDirectory,
	assertOutputOutsideInputs
};

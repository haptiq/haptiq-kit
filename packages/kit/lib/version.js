/**
 * Version Bump Module
 * 
 * Bumps the version in package.json and any files listed under version.files.
 * Other version-carrying root files are detected and suggested.
 * See the README for details.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import semver from 'semver';


/**
 * Main version bump function — updates package.json and the configured files.
 *
 * @param {Object} config - Configuration object from haptiq.config.js
 * @param {string} bump - 'patch' | 'minor' | 'major' | explicit version like '2.1.0'
 * @param {boolean} force - Allow writing an explicit version that is not valid semver
 * @returns {Promise<void>}
 */
async function bumpVersion(config, bump = 'patch', force = false) {
	const projectRoot = process.cwd();
	const pkgPath = path.join(projectRoot, 'package.json');

	let rawPkg;
	try {
		rawPkg = readFileSync(pkgPath, 'utf8');
	} catch {
		throw new Error('Could not read package.json — make sure you are in the project root.');
	}

	const pkg = JSON.parse(rawPkg);
	const oldVersion = pkg.version;

	if (!oldVersion) {
		throw new Error('No version field found in package.json.');
	}

	const newVersion = calcNewVersion(oldVersion, bump, force);

	const files = config.version?.files ?? [];
	const hasConfig = files.length > 0;

	// Version-carrying root files still on the old version but not in the config.
	// Both paths below use this: the guard to bail, the final report to suggest.
	const suggestions = detectUnmanaged(projectRoot, oldVersion, configCoverage(files));

	// No-config guard: we found version files (plugin header, readme, PHP constant)
	// still on the old version but have no config for them — so rather than bump
	// package.json alone and leave them behind, change nothing and scaffold a config.
	if (!hasConfig && suggestions.length > 0) {
		reportMissingVersionConfig(suggestions, oldVersion, newVersion);
		process.exitCode = 1;
		return;
	}

	// Informational only — the user may be intentionally correcting a mistake.
	if (isDowngrade(oldVersion, newVersion)) {
		console.warn(`⚠️  New version (${newVersion}) is lower than current version (${oldVersion}). Proceeding anyway.`);
	}

	console.log(`Bumping version: ${oldVersion} → ${newVersion}`);

	// Every file we touch yields a result: 'changed' (written), 'unchanged'
	// (already at the target version) or 'skipped' (missing file/pattern).
	const results = [];

	// Treat package.json like any file: skip the write if it's already current.
	// String replace preserves original formatting (indentation, trailing newline).
	const updatedPkg = rawPkg.replace(
		/("version"\s*:\s*")[^"]*(")/,
		`$1${newVersion}$2`
	);
	if (updatedPkg !== rawPkg) {
		writeFileSync(pkgPath, updatedPkg, 'utf8');
		results.push({ label: 'package.json', status: 'changed' });
	} else {
		results.push({ label: 'package.json', status: 'unchanged' });
	}

	// The only things we write are the files explicitly listed in the config.
	if (hasConfig) {
		results.push(...updateConfiguredFiles(files, projectRoot, newVersion));
	}

	reportResults(results, newVersion, oldVersion, suggestions, hasConfig);
}


/**
 * Print a grouped summary of the bump: what changed, what was already current,
 * and what was skipped — in that reading order, with the verdict last.
 *
 * @param {Array<{label: string, status: string, detail?: string}>} results
 * @param {string} newVersion
 * @param {string} oldVersion
 * @param {Array<{path: string, type: string, constant?: string}>} suggestions
 * @param {boolean} hasConfig - Whether version.files already has entries
 */
function reportResults(results, newVersion, oldVersion, suggestions = [], hasConfig = false) {
	const changed = results.filter(result => result.status === 'changed');
	const unchanged = results.filter(result => result.status === 'unchanged');
	const skipped = results.filter(result => result.status === 'skipped');

	const lines = [''];

	if (changed.length > 0) {
		lines.push(`Updated ${changed.length} file(s):`);
		for (const result of changed) lines.push(`  ✓ ${result.label}`);
		lines.push('');
	}
	if (unchanged.length > 0) {
		lines.push(`Unchanged ${unchanged.length} file(s) (already at ${newVersion}):`);
		for (const result of unchanged) lines.push(`  – ${result.label}`);
		lines.push('');
	}
	if (skipped.length > 0) {
		lines.push(`Skipped ${skipped.length}:`);
		for (const result of skipped) lines.push(`  ⚠ ${result.label} — ${result.detail}`);
		lines.push('');
	}
	if (suggestions.length > 0) {
		lines.push(...renderSuggestions(suggestions, oldVersion, hasConfig));
		lines.push('');
	}

	// The "else" is reachable only when new === old — package.json always changes
	// on a real bump — so "nothing changed" safely means "already at this version".
	if (changed.length > 0) {
		const note = skipped.length ? `  (${skipped.length} skipped — see above)` : '';
		lines.push(`✅ Version bumped to ${newVersion}${note}`);
	} else {
		lines.push(`ℹ️  Already at ${newVersion} — nothing to do.`);
	}

	console.log(lines.join('\n'));
}


/**
 * No-config guard report: version-carrying files were found on the old version but
 * there is no config for them. Nothing has been written — explain the risk, list
 * what was found, and print a paste-ready config block so the user can scaffold and re-run.
 *
 * @param {Array<{path: string, type: string, constant?: string}>} suggestions
 * @param {string} oldVersion
 * @param {string} newVersion
 */
function reportMissingVersionConfig(suggestions, oldVersion, newVersion) {
	const lines = [''];

	lines.push(`Found ${suggestions.length} version-carrying file(s) still at ${oldVersion} that kit won't bump without config:`);
	lines.push('');
	for (const entry of suggestions) lines.push(`  • ${describeEntry(entry)}`);
	lines.push('');
	lines.push(`Bumping only package.json to ${newVersion} would leave these behind and ship a`);
	lines.push('half-updated release. Add this to haptiq.config.js, then re-run:');
	lines.push('');
	lines.push('    version: {');
	lines.push('        files: [');
	for (const entry of suggestions) lines.push(`            ${configEntryLine(entry)},`);
	lines.push('        ],');
	lines.push('    },');
	lines.push('');
	lines.push('🛑 Nothing was changed.');

	console.log(lines.join('\n'));
}


/**
 * Human-readable one-line description of a detected version.files entry.
 *
 * @param {{path: string, type: string, constant?: string}} entry
 * @returns {string}
 */
function describeEntry(entry) {
	const labels = {
		'plugin-header': 'plugin header',
		'style-header': 'style.css header',
		'stable-tag': 'readme stable tag',
		'php-constant': `constant ${entry.constant}`,
	};
	return `${entry.path} (${labels[entry.type]})`;
}


/**
 * Render a single version.files entry as a config line.
 *
 * @param {{path: string, type: string, constant?: string}} entry
 * @returns {string}
 */
function configEntryLine(entry) {
	return entry.constant
		? `{ path: '${entry.path}', type: '${entry.type}', constant: '${entry.constant}' }`
		: `{ path: '${entry.path}', type: '${entry.type}' }`;
}


/**
 * Build the suggestion block. With no config yet, emit a complete, paste-ready
 * `version: { files: [...] }` object; when the user already has entries, emit
 * just the lines to append to their existing array.
 *
 * @param {Array<{path: string, type: string, constant?: string}>} suggestions
 * @param {string} oldVersion
 * @param {boolean} hasConfig
 * @returns {string[]}
 */
function renderSuggestions(suggestions, oldVersion, hasConfig) {
	const lines = [`Found ${suggestions.length} more location(s) still at ${oldVersion}, not in your config:`, ''];

	if (hasConfig) {
		lines.push('  Add these to your version.files array:', '');
		for (const entry of suggestions) lines.push(`    ${configEntryLine(entry)},`);
	} else {
		lines.push('  Add this to haptiq.config.js:', '');
		lines.push('    version: {');
		lines.push('        files: [');
		for (const entry of suggestions) lines.push(`            ${configEntryLine(entry)},`);
		lines.push('        ],');
		lines.push('    },');
	}

	return lines;
}


/**
 * Calculate the new version string from the current version and bump type.
 *
 * @param {string} current - Current semver string e.g. '1.2.3'
 * @param {string} bump - 'patch' | 'minor' | 'major' | explicit version
 * @param {boolean} force - Allow an explicit version that is not valid semver
 * @returns {string}
 */
function calcNewVersion(current, bump, force = false) {
	const validBumps = ['patch', 'minor', 'major'];

	// Named bump (patch/minor/major): needs a clean semver base to bump safely.
	// Pre-releases are fine — semver.inc() resolves them sensibly, e.g. from
	// 1.0.2-beta: major → 2.0.0, minor → 1.1.0, patch → 1.0.2.
	if (validBumps.includes(bump)) {
		if (!semver.valid(current)) {
			throw new Error(
				`Current version "${current}" is not valid semver.\n` +
				`    Unable to determine the correct ${bump} bump. Please set the version explicitly:\n` +
				`    kit version <new-version>`
			);
		}
		return semver.inc(current, bump);
	}

	// Anything starting with a digit is treated as an explicit version. Reject
	// values that are not valid semver so a typo can't be written into every
	// file — unless the user opts out with --force.
	if (/^\d/.test(bump)) {
		if (!semver.valid(bump) && !force) {
			throw new Error(
				`"${bump}" is not valid semver.\n` +
				`    Refusing to write it. Fix the version, or pass --force to write it anyway:\n` +
				`    kit version ${bump} --force`
			);
		}
		if (!semver.valid(bump)) {
			console.warn(`⚠️  "${bump}" doesn't look like valid semver. Writing it anyway (--force).`);
		}
		return bump;
	}

	throw new Error(`Invalid bump "${bump}". Use patch, minor, major, or an explicit version like 2.1.0.`);
}


/**
 * Determine whether newVersion is a downgrade from oldVersion.
 * Uses semver comparison when both are valid (correctly orders pre-releases),
 * otherwise falls back to a simple numeric segment comparison.
 *
 * @param {string} oldVersion
 * @param {string} newVersion
 * @returns {boolean}
 */
function isDowngrade(oldVersion, newVersion) {
	if (semver.valid(oldVersion) && semver.valid(newVersion)) {
		return semver.lt(newVersion, oldVersion);
	}

	const oldParts = oldVersion.split('.').map(n => parseInt(n, 10) || 0);
	const newParts = newVersion.split('.').map(n => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
		const a = newParts[i] || 0;
		const b = oldParts[i] || 0;
		if (a !== b) return a < b;
	}
	return false;
}


/**
 * Config-driven update: processes only the files listed in version.files.
 * package.json is always updated separately before this runs.
 *
 * @param {Array} files - Entries from version.files in haptiq.config.js
 * @param {string} projectRoot
 * @param {string} newVersion
 * @returns {Array<{label: string, status: string, detail?: string}>}
 */
function updateConfiguredFiles(files, projectRoot, newVersion) {
	// Human-readable description of what each type looks for, used in warnings.
	const targetLabel = {
		'plugin-header': '"* Version:" line',
		'style-header': '"Version:" line',
		'stable-tag': '"Stable tag:" line',
		'php-constant': entry => `constant "${entry.constant}"`,
	};

	const results = [];

	for (const entry of files) {
		const filePath = path.join(projectRoot, entry.path);
		const label = entry.type === 'php-constant' ? `${entry.path} (${entry.constant})` : entry.path;

		if (!existsSync(filePath)) {
			results.push({ label, status: 'skipped', detail: 'file not found' });
			continue;
		}

		let status;
		switch (entry.type) {
			case 'plugin-header':
				status = updateFile(filePath, /^(\s*\*\s*Version:\s*)(.+)$/m, newVersion);
				break;
			case 'style-header':
				status = updateFile(filePath, /^(Version:\s*)(.+)$/m, newVersion);
				break;
			case 'stable-tag':
				status = updateFile(filePath, /^(Stable tag:\s*)(.+)$/im, newVersion);
				break;
			case 'php-constant':
				status = updatePhpConstant(filePath, entry.constant, newVersion);
				break;
		}

		// Configured targets are explicit promises — a miss almost always means a
		// typo in the config or a file that changed shape, so surface it clearly.
		if (status === 'nomatch') {
			const describe = targetLabel[entry.type];
			const what = typeof describe === 'function' ? describe(entry) : describe;
			results.push({ label, status: 'skipped', detail: `no ${what} found` });
		} else {
			results.push({ label, status });
		}
	}

	return results;
}


/**
 * Apply a regex replacement to a file. Only writes if the content changed.
 *
 * @param {string} filePath
 * @param {RegExp} regex - Must capture the prefix as $1; new version replaces $2
 * @param {string} newVersion
 * @returns {'changed'|'unchanged'|'nomatch'} 'nomatch' = the pattern was not
 *   found; 'unchanged' = found but already at newVersion; 'changed' = written.
 */
function updateFile(filePath, regex, newVersion) {
	const content = readFileSync(filePath, 'utf8');
	if (!regex.test(content)) return 'nomatch';

	const updated = content.replace(regex, `$1${newVersion}`);
	if (updated === content) return 'unchanged';

	writeFileSync(filePath, updated, 'utf8');
	return 'changed';
}


/**
 * Update a PHP version constant (define() or const syntax) in a file.
 *
 * @param {string} filePath
 * @param {string} constantName - e.g. 'MYPLUGIN_VERSION'
 * @param {string} newVersion
 * @returns {'changed'|'unchanged'|'nomatch'} 'nomatch' = the constant is not
 *   defined here; 'unchanged' = defined but already at newVersion.
 */
function updatePhpConstant(filePath, constantName, newVersion) {
	const content = readFileSync(filePath, 'utf8');

	const defineRegex = new RegExp(
		`(define\\s*\\(\\s*['"]${constantName}['"]\\s*,\\s*['"])[^'"]+(['"])`,
		'g'
	);
	const constRegex = new RegExp(
		`(const\\s+${constantName}\\s*=\\s*['"])[^'"]+(['"])`,
		'g'
	);

	// Presence check with fresh, non-global regexes so it can't be thrown off by
	// the lastIndex state of the global regexes used for replacement.
	const present =
		new RegExp(`define\\s*\\(\\s*['"]${constantName}['"]`).test(content) ||
		new RegExp(`const\\s+${constantName}\\s*=`).test(content);
	if (!present) return 'nomatch';

	const updated = content
		.replace(defineRegex, `$1${newVersion}$2`)
		.replace(constRegex, `$1${newVersion}$2`);

	if (updated === content) return 'unchanged';

	writeFileSync(filePath, updated, 'utf8');
	return 'changed';
}


/**
 * Coverage keys for configured mode: exactly the targets the user listed.
 *
 * @param {Array} files - version.files entries
 * @returns {Set<string>}
 */
function configCoverage(files) {
	const set = new Set();
	for (const entry of files) {
		set.add(entry.type === 'php-constant' ? `php-constant:${entry.path}:${entry.constant}` : `${entry.type}:${entry.path}`);
	}
	return set;
}


/**
 * Detect version-carrying locations on the project root that currently hold
 * oldVersion but are NOT in the config, and return them as version.files entries.
 *
 * Gating on oldVersion keeps this quiet and self-limiting: a location we don't
 * write drops off oldVersion after the bump, so it stops being suggested. With an
 * empty `covered` set (no config) it suggests everything it finds.
 *
 * @param {string} projectRoot
 * @param {string} oldVersion - The version being bumped FROM
 * @param {Set<string>} covered - Keys of the files already in the config
 * @returns {Array<{path: string, type: string, constant?: string}>}
 */
function detectUnmanaged(projectRoot, oldVersion, covered) {
	const qualifiers = ['REQUIRED', 'MIN', 'MINIMUM', 'CORE', 'WP', 'PHP', 'WORDPRESS', 'MYSQL'];
	const esc = oldVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const suggestions = [];

	const suggest = (entry) => {
		const key = entry.constant ? `php-constant:${entry.path}:${entry.constant}` : `${entry.type}:${entry.path}`;
		if (!covered.has(key)) suggestions.push(entry);
	};

	const phpFiles = readdirSync(projectRoot).filter(f => f.endsWith('.php'));

	for (const file of phpFiles) {
		const content = readFileSync(path.join(projectRoot, file), 'utf8');

		// Plugin header line holding oldVersion.
		if (new RegExp(`^\\s*\\*\\s*Version:\\s*${esc}\\s*$`, 'm').test(content)) {
			suggest({ path: file, type: 'plugin-header' });
		}

		// Version-named constants holding oldVersion, minus qualifier-named ones
		// (REQUIRED/MIN/... — those track something other than the project version).
		const defineRegex = new RegExp(`define\\s*\\(\\s*['"]([A-Z_]*VERSION[A-Z_]*)['"]\\s*,\\s*['"]${esc}['"]\\s*\\)`, 'g');
		const constRegex = new RegExp(`const\\s+([A-Z_]*VERSION[A-Z_]*)\\s*=\\s*['"]${esc}['"]`, 'g');
		const names = new Set();
		let match;
		while ((match = defineRegex.exec(content)) !== null) {
			if (!qualifiers.some(q => match[1].includes(q))) names.add(match[1]);
		}
		while ((match = constRegex.exec(content)) !== null) {
			if (!qualifiers.some(q => match[1].includes(q))) names.add(match[1]);
		}
		for (const constant of names) {
			suggest({ path: file, type: 'php-constant', constant });
		}
	}

	const stylePath = path.join(projectRoot, 'style.css');
	if (existsSync(stylePath) && new RegExp(`^Version:\\s*${esc}\\s*$`, 'm').test(readFileSync(stylePath, 'utf8'))) {
		suggest({ path: 'style.css', type: 'style-header' });
	}

	const readmePath = path.join(projectRoot, 'readme.txt');
	if (existsSync(readmePath) && new RegExp(`^Stable tag:\\s*${esc}\\s*$`, 'im').test(readFileSync(readmePath, 'utf8'))) {
		suggest({ path: 'readme.txt', type: 'stable-tag' });
	}

	return suggestions;
}


export { bumpVersion };

/**
 * Ship Module
 *
 * Builds CSS and JS assets then syncs them to a remote or local
 * destination via rsync. Target configuration lives in haptiq.config.js
 * under the `ship` key.
 */
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import readline from 'readline';
import path from 'path';
import { glob } from 'glob';
import { zipSync } from 'fflate';
import { buildCSS } from './css.js';
import { buildJS } from './js.js';


/**
 * Main ship function — builds assets then rsyncs for each target
 *
 * @param {Object} config - Configuration object from haptiq.config.js
 * @param {boolean} verbose - Show detailed output
 * @param {{ target?: string, dev?: boolean }} options - CLI options
 * @returns {Promise<void>}
 */
async function ship(config, verbose, options = {}) {
	const { target: targetName, dev: cliDev } = options;

	const shipConfig = config.ship;

	const { targets = {}, src = './', exclude, delete: deleteRemoved = false } = shipConfig ?? {};

	if (!exclude || exclude.length === 0) {
		console.warn('⚠️  No ship.exclude configured — everything in src will be synced including node_modules. Add an exclude list to haptiq.config.js to filter unwanted files.');
	}

	const configuredTargetNames = Object.keys(targets);
	let targetsToProcess;

	if (targetName) {
		if (targetName !== 'dist' && !targets[targetName]) {
			const available = [...configuredTargetNames, 'dist'].join(', ');
			throw new Error(`Target "${targetName}" not found. Available: ${available}`);
		}
		targetsToProcess = [targetName];
	} else {
		if (configuredTargetNames.length === 0) {
			throw new Error('No ship targets configured. Add a ship.targets object to haptiq.config.js, or run `kit ship dist` for a local build.');
		}
		const selected = await promptTarget(configuredTargetNames);
		targetsToProcess = [selected];
	}

	for (const name of targetsToProcess) {
		const targetConfig = targets[name] ?? {};
		const dev = (cliDev ?? targetConfig.dev) ?? false;

		await buildCSS(config, verbose, dev);
		await buildJS(config, verbose, { dev });

		if (targetConfig.zip) {
			await zipSingleTarget(name, targetConfig, { src, exclude }, verbose);
		} else {
			await shipSingleTarget(name, targetConfig, { src, exclude, deleteRemoved }, verbose);
		}

		console.log(`✅ Shipped to [${name}].`);
	}
}


/**
 * Zip a single target — builds a zip archive at the configured path.
 * Aborts if the destination directory does not exist or the zip file already exists.
 *
 * @param {string} name - Target name (for log messages)
 * @param {{ zip: string }} targetConfig - Target settings
 * @param {{ src: string, exclude: string[] }} shipConfig - Shared settings
 * @param {boolean} verbose - List each file added to the archive
 * @returns {Promise<void>}
 */
async function zipSingleTarget(name, targetConfig, shipConfig, verbose) {
	const { zip: zipPathTemplate } = targetConfig;
	const { src = './', exclude = [] } = shipConfig;

	const projectRoot = process.cwd();
	const projectName = path.basename(projectRoot);

	let version = '0.0.0';
	const pkgPath = path.join(projectRoot, 'package.json');
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
			version = pkg.version ?? version;
		} catch { /* use default */ }
	}

	const resolvedZipPath = zipPathTemplate
		.replace(/\{name\}/g, projectName)
		.replace(/\{version\}/g, version);

	const zipDir = path.dirname(resolvedZipPath);
	if (!existsSync(zipDir)) {
		throw new Error(`Destination directory does not exist: ${zipDir}\nCreate it manually before shipping.`);
	}

	if (existsSync(resolvedZipPath)) {
		throw new Error(`Zip archive already exists: ${resolvedZipPath}\nRemove it manually before shipping to avoid accidental overwrites.`);
	}

	const resolvedSrc = path.resolve(projectRoot, src);

	const globIgnore = exclude.flatMap(e => {
		const stripped = e.replace(/\/$/, '');
		return [stripped, `${stripped}/**`];
	});

	console.log(`📦 Packing [${name}] → ${resolvedZipPath}`);

	const files = await glob('**', {
		cwd: resolvedSrc,
		dot: true,
		nodir: true,
		ignore: globIgnore,
	});

	const zipData = {};
	for (const file of files) {
		if (verbose) {
			process.stdout.write(`  ${file}\n`);
		}
		zipData[`${projectName}/${file}`] = readFileSync(path.join(resolvedSrc, file));
	}

	const zipped = zipSync(zipData);
	writeFileSync(resolvedZipPath, zipped);
}


/**
 * Rsync a single target
 *
 * @param {string} name - Target name (for error messages)
 * @param {{ dest?: string, host?: string, dev?: boolean }} targetConfig - Target settings. `dest` is required for remote targets; local targets derive it automatically.
 * @param {{ src: string, exclude: string[], deleteRemoved: boolean }} shipConfig - Shared settings
 * @param {boolean} verbose - Stream rsync output to console
 * @returns {Promise<void>}
 */
async function shipSingleTarget(name, targetConfig, shipConfig, verbose) {
	const { dest, host } = targetConfig;
	const { src = './', exclude = [], deleteRemoved = false } = shipConfig;

	let destination;

	if (host) {
		if (!dest) {
			throw new Error(`ship.targets.${name}: missing required field "dest" for remote target`);
		}
		destination = `${host}:${dest}`;
	} else {
		if (dest) {
			console.warn(`⚠️  ship.targets.${name}: "dest" has no effect on local targets — destination is always derived as ../project-name-dist/.`);
		}

		const projectRoot = process.cwd();
		const projectName = path.basename(projectRoot);
		const localDest = path.resolve(projectRoot, '..', `${projectName}-dist`);

		if (existsSync(localDest)) {
			throw new Error(`Local destination "${localDest}" already exists. Remove it manually before shipping to avoid overwriting existing content.`);
		}

		destination = localDest;
	}

	const projectRoot = process.cwd();
	const resolvedSrc = path.resolve(projectRoot, src);
	if (resolvedSrc !== projectRoot && !resolvedSrc.startsWith(projectRoot + path.sep)) {
		throw new Error(`ship.src must be inside the project root. Got: ${resolvedSrc}`);
	}

	const normalizedSrc = src.endsWith('/') ? src : `${src}/`;

	const excludeArgs = exclude.flatMap(e => ['--exclude', e]);
	const deleteArgs = deleteRemoved ? ['--delete', '--delete-excluded'] : [];

	const args = [
		'-az',
		...(verbose ? ['-v'] : []),
		...excludeArgs,
		...deleteArgs,
		normalizedSrc,
		destination,
	];

	console.log(`🚀 Shipping [${name}] → ${destination}`);

	if (deleteRemoved) {
		const dryRunArgs = ['-azv', '-n', ...excludeArgs, ...deleteArgs, normalizedSrc, destination];
		const deletions = await rsyncDryRun(dryRunArgs);
		if (deletions.length > 0) {
			await confirmDeletion(deletions, destination);
		}
	}

	await spawnRsync(args, verbose);
}


/**
 * Run rsync in dry-run mode and return the list of files that would be deleted.
 *
 * @param {string[]} args - rsync arguments (must include -n and -v)
 * @returns {Promise<string[]>}
 */
function rsyncDryRun(args) {
	return new Promise((resolve, reject) => {
		const childProcess = spawn('rsync', args, { shell: false });

		let stdout = '';
		let stderr = '';
		let rejected = false;

		childProcess.stdout.on('data', (data) => { stdout += data.toString(); });
		childProcess.stderr.on('data', (data) => { stderr += data.toString(); });

		childProcess.on('close', (code) => {
			if (rejected) return;
			if (code === 0) {
				const deletions = stdout
					.split('\n')
					.filter(line => line.startsWith('deleting '))
					.map(line => line.slice('deleting '.length).trim());
				resolve(deletions);
			} else {
				reject(new Error(`rsync dry-run failed: ${stderr.trim()}`));
			}
		});

		childProcess.on('error', (err) => {
			rejected = true;
			if (err.code === 'ENOENT') {
				reject(new Error('rsync not found. Please ensure rsync is installed on your system.'));
			} else {
				reject(new Error(`Failed to start rsync: ${err.message}`));
			}
		});
	});
}


/**
 * Show a deletion preview and require the user to type DELETE to continue.
 *
 * @param {string[]} deletions - Files that would be deleted
 * @param {string} destination - Rsync destination (shown in the warning)
 * @returns {Promise<void>}
 */
async function confirmDeletion(deletions, destination) {
	const count = deletions.length;
	const shown = deletions.slice(0, 7);

	console.log(`\n⚠️  ${count} ${count === 1 ? 'file' : 'files'} will be permanently deleted from:`);
	console.log(`    ${destination}\n`);

	for (const file of shown) {
		console.log(`    - ${file}`);
	}

	if (count > 7) {
		console.log(`    … and ${count - 7} more files.`);
	}

	console.log('\nWARNING: These files will be removed irrevocably!\n');
	console.log('To proceed, type DELETE and press Enter (Ctrl+C to abort):');

	const answer = await readLine();

	if (answer !== 'DELETE') {
		throw new Error('Aborted — sync cancelled.');
	}
}


/**
 * Prompt the user to choose a ship target from the available options.
 * Accepts either the target name or its list number.
 *
 * @param {string[]} configuredTargetNames - Target names from haptiq.config.js
 * @returns {Promise<string>} The chosen target name
 */
async function promptTarget(configuredTargetNames) {
	const options = [...configuredTargetNames, 'dist'];

	console.log('\nNo target specified. Choose one of the available targets to ship to:\n');
	options.forEach((name, i) => {
		console.log(`  ${i + 1}) ${name}`);
	});

	const answer = (await readLine('\nTarget: ')).trim();

	const num = parseInt(answer, 10);
	if (!isNaN(num) && num >= 1 && num <= options.length) {
		return options[num - 1];
	}

	if (options.includes(answer)) {
		return answer;
	}

	throw new Error(`"${answer}" is not a valid target. Run \`kit ship <target>\` to skip this prompt.`);
}


/**
 * Read a single line from stdin.
 *
 * @param {string} prompt - Text to display before waiting for input
 * @returns {Promise<string>}
 */
function readLine(prompt = '') {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(prompt, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}


/**
 * Spawn rsync as a child process without shell interpolation
 *
 * @param {string[]} args - rsync argument array
 * @param {boolean} verbose - Pipe stdout to console
 * @returns {Promise<void>}
 */
function spawnRsync(args, verbose) {
	return new Promise((resolve, reject) => {
		const childProcess = spawn('rsync', args, { shell: false });

		let stderr = '';
		let rejected = false;

		if (verbose) {
			childProcess.stdout.on('data', (data) => process.stdout.write(data));
		}

		childProcess.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		childProcess.on('close', (code) => {
			if (rejected) return;
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`rsync failed: ${stderr.trim()}`));
			}
		});

		childProcess.on('error', (err) => {
			rejected = true;
			if (err.code === 'ENOENT') {
				reject(new Error('rsync not found. Please ensure rsync is installed on your system.'));
			} else {
				reject(new Error(`Failed to start rsync: ${err.message}`));
			}
		});
	});
}


export { ship };

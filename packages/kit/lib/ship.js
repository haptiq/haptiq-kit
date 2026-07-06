/**
 * Ship Module
 *
 * Builds CSS and JS assets then syncs them to a remote or local
 * destination via rsync. Target configuration lives in haptiq.config.js
 * under the `ship` key.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
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
		targetsToProcess = configuredTargetNames;
	}

	for (const name of targetsToProcess) {
		const targetConfig = targets[name] ?? {};
		const dev = cliDev || targetConfig.dev || false;

		await buildCSS(config, verbose, dev);
		await buildJS(config, verbose, { dev });
		await shipSingleTarget(name, targetConfig, { src, exclude, deleteRemoved }, verbose);

		console.log(`✅ Shipped to [${name}].`);
	}
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

	const args = [
		'-az',
		...(verbose ? ['-v'] : []),
		...exclude.flatMap(e => ['--exclude', e]),
		...(deleteRemoved ? ['--delete', '--delete-excluded'] : []),
		normalizedSrc,
		destination,
	];

	console.log(`🚀 Shipping [${name}] → ${destination}`);

	await spawnRsync(args, verbose);
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

		if (verbose) {
			childProcess.stdout.on('data', (data) => process.stdout.write(data));
		}

		childProcess.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		childProcess.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`rsync failed: ${stderr.trim()}`));
			}
		});

		childProcess.on('error', (err) => {
			if (err.code === 'ENOENT') {
				reject(new Error('rsync not found. Please ensure rsync is installed on your system.'));
			} else {
				reject(new Error(`Failed to start rsync: ${err.message}`));
			}
		});
	});
}


export { ship };

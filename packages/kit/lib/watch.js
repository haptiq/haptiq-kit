/**
 * Watch Module
 *
 * Generic file watching for the build pipelines. Watch rebuilds re-run
 * the *same invocation* that started them, so `--only` / `--skip` / `--dev`
 * are honoured on every rebuild without any extra mapping logic.
 */
import fs from 'fs';
import path from 'path';
import { watch } from 'chokidar';


// Coalesce the burst of events an editor save can produce (write + rename + chmod)
const DEBOUNCE_MS = 75;

// File events that can affect a build; directory events are ignored
const RELEVANT_EVENTS = new Set(['add', 'change', 'unlink']);

// Idle "still watching" spinner animation
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 100;


/**
 * Start watching and keep the process alive until interrupted
 *
 * Each watcher is `{ dirs, extensions, run, label }`:
 * - `dirs`       directories to watch (recursive, relative to the project root)
 * - `extensions` file extensions that should trigger `run` (e.g. ['.scss'])
 * - `run`        async function performing the rebuild
 * - `label`      name used in log output (e.g. 'CSS')
 *
 * A failing rebuild prints its error and leaves the watcher running, so a
 * syntax error mid-edit never drops you back to the shell.
 *
 * @param {Array<{dirs: string[], extensions: string[], run: Function, label: string}>} watchers - Watcher descriptors
 * @param {{ verbose?: boolean }} options - Output options
 * @returns {Promise<void>} Resolves once the watchers have been closed
 */
async function startWatch(watchers, options = {}) {
	const verbose = options.verbose ?? false;
	const projectRoot = process.cwd();
	const instances = [];

	// One spinner shared by every watcher, so two pipelines rebuilding at once
	// can't fight over the line. Silent unless stdout is a terminal.
	const spinner = createSpinner(process.stdout.isTTY === true);

	for (const watcher of watchers) {
		const resolved = watcher.dirs.map(dir => resolveWatchDir(dir, projectRoot, watcher.label));
		const existing = resolved.filter(dir => fs.existsSync(dir));

		for (const [i, dir] of resolved.entries()) {
			if (!fs.existsSync(dir)) {
				console.warn(`⚠️  [${watcher.label}] watch directory "${watcher.dirs[i]}" does not exist — not watching`);
			}
		}

		if (existing.length === 0) {
			continue;
		}

		const schedule = createScheduler(watcher, verbose, spinner);

		// chokidar watches directories recursively by default, including
		// subfolders created after startup — events are filtered by extension here.
		const instance = watch(existing, { ignoreInitial: true, persistent: true });

		instance.on('all', (event, changedPath) => {
			if (!RELEVANT_EVENTS.has(event)) return;
			if (!watcher.extensions.includes(path.extname(changedPath).toLowerCase())) return;
			schedule(path.relative(projectRoot, changedPath));
		});

		instance.on('error', error => {
			console.error(`❌ [${watcher.label}] watch error:`, error.message);
		});

		instances.push(instance);

		const shown = existing.map(dir => path.relative(projectRoot, dir) || '.').join(', ');
		console.log(`👀 Watching ${shown} for ${watcher.label} changes`);
	}

	if (instances.length === 0) {
		throw new Error('Nothing to watch — no watch directory exists');
	}

	console.log('   Press Ctrl+C to stop.');

	spinner.start();

	await new Promise(resolve => {
		const stop = async () => {
			spinner.stop();
			console.log('\n👋 Stopping watch.');
			await Promise.all(instances.map(instance => instance.close()));
			resolve();
		};

		process.once('SIGINT', stop);
		process.once('SIGTERM', stop);
	});
}


/**
 * Build the debounced, non-overlapping rebuild scheduler for one watcher
 *
 * Changes arriving while a rebuild is in flight queue exactly one follow-up
 * run, so a long build never stacks up a backlog of identical rebuilds.
 *
 * @param {{ run: Function, label: string }} watcher - Watcher descriptor
 * @param {boolean} verbose - List the changed files before rebuilding
 * @param {Object} spinner - Shared idle spinner, paused while a rebuild runs
 * @returns {Function} Scheduler accepting a changed file path
 */
function createScheduler(watcher, verbose, spinner) {
	const changed = new Set();
	let timer = null;
	let running = false;
	let pending = false;

	async function execute() {
		running = true;

		spinner.pause();

		const files = [...changed];
		changed.clear();

		const count = files.length;
		console.log(`\n🔄 [${watcher.label}] ${count} change${count === 1 ? '' : 's'} — rebuilding…`);

		if (verbose) {
			for (const file of files) {
				console.log(`  • ${file}`);
			}
		}

		try {
			await watcher.run();
		} catch (error) {
			// Keep watching: the next save is probably the fix
			console.error(`❌ [${watcher.label}] rebuild failed:`, error.message);
		}

		running = false;

		if (pending) {
			pending = false;
			await execute();
		}

		spinner.resume();
	}

	return function schedule(file) {
		changed.add(file);

		if (timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(() => {
			timer = null;

			if (running) {
				pending = true;
				return;
			}

			void execute();
		}, DEBOUNCE_MS);
	};
}


/**
 * Create the idle spinner
 *
 * Runs *between* rebuilds as a sign the watcher is alive, and is paused for the
 * duration of every rebuild so build output never collides with the animation.
 * `pause`/`resume` nest: with several pipelines watching, the animation only
 * comes back once the last of them has finished.
 *
 * Disabled when stdout is not a terminal, so piping to a log file or running in
 * CI does not fill it with carriage returns.
 *
 * @param {boolean} enabled - Whether to animate at all
 * @returns {{ start: Function, pause: Function, resume: Function, stop: Function }} Spinner controls
 */
function createSpinner(enabled) {
	let timer = null;
	let frame = 0;
	let holds = 0;

	function render() {
		process.stdout.write(`\r${SPINNER_FRAMES[frame]} `);
		frame = (frame + 1) % SPINNER_FRAMES.length;
	}

	function clear() {
		process.stdout.write('\r  \r');
	}

	function start() {
		if (!enabled || timer || holds > 0) return;

		timer = setInterval(render, SPINNER_INTERVAL_MS);

		// The animation must never be the reason the process stays alive —
		// that is the watchers' job.
		timer.unref();
	}

	function pause() {
		if (!enabled) return;

		holds++;

		if (!timer) return;

		clearInterval(timer);
		timer = null;
		clear();
	}

	function resume() {
		if (!enabled) return;

		holds = Math.max(0, holds - 1);

		if (holds === 0) {
			start();
		}
	}

	function stop() {
		if (!enabled) return;

		holds = 0;

		if (timer) {
			clearInterval(timer);
			timer = null;
			clear();
		}
	}

	return { start, pause, resume, stop };
}


/**
 * Resolve and validate a watch directory against the project root
 *
 * @param {string} dir - Configured directory (relative to the project root)
 * @param {string} projectRoot - Absolute project directory
 * @param {string} label - Watcher label for error messages
 * @returns {string} Absolute path to the directory to watch
 */
function resolveWatchDir(dir, projectRoot, label) {
	if (typeof dir !== 'string' || dir.trim() === '') {
		throw new Error(`${label} watch directory must be a non-empty string`);
	}

	if (path.isAbsolute(dir) || dir.startsWith('~')) {
		throw new Error(`${label} watch directory must be a relative path`);
	}

	const resolved = path.resolve(projectRoot, dir);

	if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) {
		throw new Error(`${label} watch directory "${dir}" must be within the project directory`);
	}

	return resolved;
}


export { startWatch };

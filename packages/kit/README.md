# @haptiq/kit

Build tools for Haptiq projects. Provides CLI commands for compiling CSS/SCSS and bundling JavaScript.

## Requirements

- Node >= 24
- npm >= 11

## Installation

```sh
npm install @haptiq/kit --save-dev
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "build:css": "kit css",
    "build:js": "kit js",
    "dev": "kit --dev"
  }
}
```

## Commands

### `kit`

Called without a subcommand, `kit` builds CSS and JS once and then watches both for changes.

```sh
kit            # build css + js, then watch
kit --dev      # same, unminified
kit --verbose  # list every changed file before each rebuild
```

Press `Ctrl+C` to stop. See [Watch mode](#watch-mode) for what gets watched.

---

### `kit css`

Compiles SCSS/Sass and CSS files using a two-stage pipeline: Sass → LightningCSS.

```sh
kit css
kit css --verbose
kit css --only <name>   # only run a named config (multi-config mode)
kit css --skip <name>   # skip a named config (multi-config mode)
kit css --watch         # rebuild on every change
```

**Defaults:** reads `src/**/*.{scss,sass,css}`, writes to `css/`.

---

### `kit js`

Minifies and combines JavaScript files with Terser.

```sh
kit js
kit js --verbose
kit js --only <name>   # only run a named config (multi-config mode)
kit js --skip <name>   # skip a named config (multi-config mode)
kit js --watch         # rebuild on every change
```

**Defaults:** reads `src/**/*.js`, writes to `js/bundle.js`.

---

### Watch mode

`--watch` on `kit css` / `kit js`, and bare `kit`, keep the process running and rebuild on change.

```sh
kit css --watch
kit js --dev --watch
kit css --only blocks --watch
```

A rebuild re-runs **the exact invocation that started the watch**, so `--only`, `--skip`, `--dev` and
`--verbose` keep applying to every rebuild. That also means a changed Sass partial (`_colors.scss`,
which has no output file of its own) and a changed member of a JS bundle both trigger a correct full
rebuild.

**What is watched:** the `src/` directory, recursively — including subfolders created after startup.
Override it per pipeline with `css.watch` / `js.watch` in `haptiq.config.js`, as a single directory or
an array of them. Events are filtered by extension: `.scss`, `.sass` and `.css` trigger the CSS build,
`.js` triggers the JS build.

```js
// haptiq.config.js
export default {
  css: { src: 'src/scss/**/*.scss', dest: 'assets/css', watch: 'src/scss' },
  js:  { src: 'src/js/**/*.js',     dest: 'assets/js/bundle.js', watch: 'src/js' },
}

// Several source trees:
export default {
  css: { src: 'assets/{scss,blocks}/**/*.scss', dest: 'assets/css',
         watch: ['assets/scss', 'assets/blocks'] },
}
```

**Output must live outside the input tree.** A `dest` inside the `src` glob or inside a watch
directory is rejected with an error, because it breaks silently in three ways: the build starts
reading its own output (so edits to the real sources stop having any effect), the watcher rebuilds
forever, and `kit ship` excludes `src/` by default so the output would never deploy. Point `watch` at
the source directory rather than its parent — `assets/scss`, not `assets` — and keep `dest` beside the
source tree rather than inside it.

**Notes**

- `--watch` rebuilds use the same settings of the initial build: `kit css --watch` rebuilds minified;
  `kit css --dev --watch` rebuilds unminified and so forth.
- Rapid saves are coalesced, and changes arriving mid-rebuild queue exactly one follow-up run.
- A spinner animates while the watcher sits idle, so a quiet terminal still looks alive. It pauses for
  the duration of each rebuild, and switches itself off when stdout is not a terminal — piping to a
  log file or running in CI stays clean.
- A failing rebuild (e.g. a Sass syntax error) prints the error and keeps watching — the next save is
  usually the fix.
- There is no live-reload layer; watch mode only rebuilds for now.

---

### `kit ship [target]`

Builds CSS and JS assets, then syncs them to a destination via rsync or packages them as a zip archive.

```sh
kit ship              # prompts you to choose a target
kit ship staging      # ship to a specific named target
kit ship dist         # built-in local target (always available, no config needed)
kit ship --dev        # build without minification before shipping
kit ship --verbose    # show detailed rsync/zip output
```

When called without a target name, the command lists all configured targets and asks you to choose one before proceeding. To skip the prompt, pass the target name directly.

`kit ship dist` syncs the project to a sibling directory (`../project-name-dist/`) and is always available without any configuration.

**Target types**

| Type | Config | Behaviour |
|---|---|---|
| Remote | `host` + `dest` | rsyncs `src` to `host:dest` |
| Local | neither | rsyncs `src` to `../project-name-dist/` (same as `kit ship dist`) |
| Zip | `zip` path | packages `src` into a zip archive |

`zip` is mutually exclusive with `host` and `dest`. The zip destination directory must exist; the command aborts if the archive already exists (remove it manually to re-ship).

**Excludes and includes**

Ship applies filters in three layers, so some files and directories are excluded by default:

1. **Default excludes** — always applied, even with no config: `.DS_Store`, `Thumbs.db`, `.git*`, `node_modules`, `src`, `package.json`, `package-lock.json`, `haptiq.config.js`, `.env*`, `*.map`. By default, these don't land on a server or in an archive.
2. **`ship.exclude`** — project-specific paths, *added on top* of the defaults.
3. **`ship.include`** — an escape hatch that **wins over both** excludes. Use it to explicitly include something that would otherwise be dropped (e.g. `package.json` for a host that runs `npm install`, or `*.map` for Sentry). To re-include a whole excluded directory, use a trailing `/***` (e.g. `node_modules/***`).

Ordering matches rsync's native first-match-wins behaviour. Run `kit ship --verbose` to print the resolved default / config / include layers before syncing.

---

### `kit version [bump]`

Bumps the project version in `package.json` and propagates it to WordPress plugin/theme headers, `readme.txt`, and PHP version constants.

```sh
kit version            # bump patch (default)  →  1.2.3 → 1.2.4
kit version patch      # same as above
kit version minor      #                       →  1.2.3 → 1.3.0
kit version major      #                       →  1.2.3 → 2.0.0
kit version 2.1.0      # set an explicit version
kit version 2024.11 --force  # write a non-semver version anyway
```

After a bump the command prints a summary of exactly which files were changed.

`package.json` is the single source of truth for the current version. The only files kit ever *writes* are `package.json` and the entries you list under `version.files`. Everything else it can find is **detected and suggested**, never written on its own.

**Zero-config mode** (no `version` key in `haptiq.config.js`) scans the **project root only** — never `node_modules/`, `vendor/`, `blocks/`, etc. — for other locations still carrying the old version: WP plugin headers (`* Version:`), the `style.css` theme header, the `readme.txt` `Stable tag:`, and version-named PHP constants.

- **Nothing else found** (a plain npm package) → `package.json` is bumped. Done, just like `npm version`.
- **Something found** → kit **stops without changing anything** and prints a ready-to-paste `version.files` block. Bumping `package.json` alone here would leave the plugin header / `readme.txt` behind and ship a half-updated release (WordPress.org would still see the old version), so kit asks you to scaffold the config and re-run. The command exits non-zero so a release script or CI notices nothing was bumped.

**Explicit config** — set `version.files` to control exactly what gets updated. `package.json` is still always updated, and any *uncovered* root location still on the old version is suggested (never written) so you can add it if you want — an intentionally omitted file stays your call. When `version.files` is present, the no-config guard does not apply.

```js
// haptiq.config.js
export default {
  version: {
    files: [
      { path: 'my-plugin.php', type: 'plugin-header' },
      { path: 'my-plugin.php', type: 'php-constant', constant: 'MYPLUGIN_VERSION' },
      { path: 'readme.txt',    type: 'stable-tag' },
      { path: 'style.css',     type: 'style-header' },
    ],
  },
}
```

| `type` | Line/pattern replaced |
|---|---|
| `plugin-header` | `* Version:` in a WP plugin header |
| `style-header` | `Version:` in a WP theme `style.css` header |
| `stable-tag` | `Stable tag:` in `readme.txt` |
| `php-constant` | `define('NAME', '…')` or `const NAME = '…'` — requires a `constant` field |

**Version string handling**

- Explicit versions must be valid semver. If the value isn't (e.g. `1.2.3abc`), the command **errors and writes nothing** — pass `--force` to write it anyway.
- If the new version is **lower** than the current one, it warns and proceeds anyway (e.g. correcting a mistaken bump).
- Named bumps (`patch`/`minor`/`major`) require a valid semver base but handle pre-releases sensibly via `semver.inc`. From `1.0.2-beta`: `major` → `2.0.0`, `minor` → `1.1.0`, `patch` → `1.0.2`. Only a current version that isn't valid semver at all stops the bump and asks you to set the next version explicitly.

**Reporting** — the command prints a summary of every file it changed, along with any files already at the target version. When `version.files` names a target whose version line or constant can't be found, it warns so the miss isn't silent.

## Configuration

Create a `haptiq.config.js` in your project root. All options are optional. See [`examples/haptiq.config.js`](examples/haptiq.config.js) for a full annotated reference.

## License

GPL-2.0-or-later

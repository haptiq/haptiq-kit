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
    "build:js": "kit js"
  }
}
```

## Commands

### `kit css`

Compiles SCSS/Sass and CSS files using a two-stage pipeline: Sass → LightningCSS.

```sh
kit css
kit css --verbose
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
```

**Defaults:** reads `src/**/*.js`, writes to `js/bundle.js`.

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

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

## Configuration

Create a `haptiq.config.js` in your project root. All options are optional. See [`examples/haptiq.config.js`](examples/haptiq.config.js) for a full annotated reference.

## License

GPL-2.0-or-later

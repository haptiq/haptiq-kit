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

Bundles JavaScript files with ESBuild.

```sh
kit js
kit js --verbose
kit js --only <name>   # only run a named config (multi-config mode)
kit js --skip <name>   # skip a named config (multi-config mode)
```

**Defaults:** reads `src/**/*.js`, writes to `js/bundle.js`.

## Configuration

Create a `haptiq.config.js` in your project root. All options are optional.

```js
export default {
  css: {
    src: 'assets/**/*.{scss,sass,css}',  // default: 'src/**/*.{scss,sass,css}'
    dest: 'public/css',                  // default: 'css'
    sass: {
      style: 'expanded',
      includePaths: ['node_modules'],
    },
    lightning: {
      targets: { chrome: 90, firefox: 88, safari: 14 },
      minify: true,
      sourceMap: true,
    },
  },

  // Single bundle
  js: {
    src: 'assets/**/*.js',      // default: 'src/**/*.js'
    dest: 'public/js/bundle.js', // default: 'js/bundle.js'
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      target: 'es2020',
      treeShaking: true,  // default: false
    },
  },
};
```

### Multiple JS bundles

Use `js.configs` to define several named bundles:

```js
export default {
  js: {
    configs: {
      'app': {
        src: 'src/app/**/*.js',
        dest: 'public/js/app.bundle.js',
      },
      'components': {
        src: 'src/components/**/*.js',
        dest: 'public/js/components/',
      },
    },
  },
};
```

Then use `--only` / `--skip` to target specific configs:

```sh
kit js --only app
kit js --skip components
```

## License

GPL-2.0-or-later

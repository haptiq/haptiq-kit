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

## Configuration

Create a `haptiq.config.js` in your project root. All options are optional.

```js
module.exports = {
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

  // Combine mode — all files into one output
  js: {
    src: 'assets/**/*.js',       // default: 'src/**/*.js'
    dest: 'public/js/bundle.js', // default: 'js/bundle.js'
    terser: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
  },
};
```

### Multiple JS configs

Use `js.configs` to define several named configurations:

```js
module.exports = {
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

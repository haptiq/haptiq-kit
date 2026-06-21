# @haptiq/stylelint-config

Shared Stylelint configuration for Haptiq projects.

## Requirements

- Node >= 24
- stylelint 16.x (stylelint 17+ not yet supported — pinned to 16 for compatibility with `@wordpress/stylelint-config`)

## Installation

```sh
npm install @haptiq/stylelint-config stylelint-config-standard stylelint-config-standard-scss --save-dev
```

For WordPress projects, also install:

```sh
npm install @wordpress/stylelint-config --save-dev
```

## Usage

### Default (CSS & SCSS)

```js
// stylelint.config.js
export default {
  extends: ['@haptiq/stylelint-config']
};
```

### WordPress

```js
// stylelint.config.js
export default {
  extends: ['@haptiq/stylelint-config/wordpress']
};
```

## License

GPL-2.0-or-later

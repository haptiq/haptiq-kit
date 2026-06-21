# @haptiq/eslint-config

Shared ESLint configuration for Haptiq projects. Provides composable flat config presets for ESLint 9+.

## Requirements

- Node >= 24
- eslint >= 9.7.0

## Installation

```sh
npm install @haptiq/eslint-config --save-dev
```

For WordPress projects, also install:

```sh
npm install @wordpress/eslint-plugin --save-dev
```

## Usage

Presets are composable — combine what your project needs in `eslint.config.js`.

### Browser project

```js
import { base } from '@haptiq/eslint-config'

export default [...base]
```

### WordPress / Gutenberg project

```js
import { base, wordpress } from '@haptiq/eslint-config'

export default [...base, ...wordpress]
```

### Node.js project

```js
import { base, node } from '@haptiq/eslint-config'

export default [...base, ...node]
```

## Presets

- **`base`** — `@eslint/js` recommended + browser globals + `no-console` warn + `no-unused-vars` error
- **`wordpress`** — `@wordpress/eslint-plugin` recommended (React, JSX, a11y, i18n, WP APIs)
- **`node`** — adds Node.js globals (`process`, `__dirname`, `Buffer`, etc.)

## License

GPL-2.0-or-later

# haptiq-kit

Monorepo for shared build tools and linting configurations used across Haptiq projects.

## Packages

| Package | Description |
|---|---|
| [`@haptiq/kit`](packages/kit) | CLI for compiling CSS/SCSS and bundling JavaScript |
| [`@haptiq/browserslist-config`](packages/browserslist-config) | Shared Browserslist configuration |
| [`@haptiq/eslint-config`](packages/eslint-config) | Shared ESLint configuration |
| [`@haptiq/stylelint-config`](packages/stylelint-config) | Shared Stylelint configuration |

## Requirements

- Node >= 24
- npm >= 11

## Development

Install dependencies from the repo root:

```sh
npm install
```

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). All packages are available under `packages/`.

Releases are managed with [Changesets](https://github.com/changesets/changesets).

## License

GPL-2.0-or-later

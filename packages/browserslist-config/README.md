# @haptiq/browserslist-config

Shared Browserslist configuration for Haptiq projects.

## Installation

```sh
npm install @haptiq/browserslist-config --save-dev
```

## Usage

In a `.browserslistrc` file (or the `browserslist` field in `package.json`):

```
extends @haptiq/browserslist-config
```

### Modern variant

For projects that only need to support evergreen browsers:

```
extends @haptiq/browserslist-config/modern
```

## Targets

See [`index.js`](./index.js) for the default targets and [`modern.js`](./modern.js) for the modern variant — these are the source of truth.

## Overriding

Add additional queries to extend or override:

```
extends @haptiq/browserslist-config
Safari >= 14
```

## License

GPL-2.0-or-later

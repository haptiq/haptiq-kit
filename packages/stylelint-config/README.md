# @haptiq/stylelint-config

Shared Stylelint configuration for Haptiq projects.

## Requirements

- Node >= 24
- npm >= 11
- stylelint 17

## Installation

```sh
npm install @haptiq/stylelint-config --save-dev
```

## Usage

```js
// stylelint.config.mjs
export default {
  extends: ['@haptiq/stylelint-config']
};
```

## VS Code

Install the [Stylelint extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) and add the following to your `.vscode/settings.json` to enable linting for CSS and SCSS:

```json
{
  "stylelint.validate": ["css", "scss"]
}
```


## License

GPL-2.0-or-later

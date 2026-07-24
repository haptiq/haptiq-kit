# @haptiq/kit

## 0.10.0

### Minor Changes

- 2ab7c1d: Add multi-config support to the css command.

## 0.9.1

### Patch Changes

- Updated dependencies [f112d61]
  - @haptiq/browserslist-config@0.2.0

## 0.9.0

### Minor Changes

- 7d4f7f0: Lower the Node/npm engines requirement from >=24/>=11 to >=22.12.0/>=10.9.0. Node 24 was never technically required — the true floor is commander@15 (node >=22.12). This restores support for the Node 22 LTS line.

## 0.8.0

### Minor Changes

- f5efeef: Add `kit version` command to bump version in package.json and configured files.

## 0.7.0

### Minor Changes

- e713175: Add zip option to ship command + fix documentation

## 0.6.0

### Minor Changes

- 574b136: Fix CLI flags being silently ignored, validate ship config inputs, and prevent misleading error messages when rsync is missing.

## 0.5.0

### Minor Changes

- 0af6f17: Add dry-run deletion preview and confirmation to avoid accidental deletions

## 0.4.0

### Minor Changes

- c5d9fd7: Add ship command to @haptiq/kit to allow easy deployments via rsync

## 0.3.0

### Minor Changes

- 12bec4b: Add --dev parameter to JS & CSS builds, and some code enhancements

## 0.2.0

### Minor Changes

- 401dfcb: Using browserslist and @haptiq/browserslist-config instead of hard-coded browser targets now

## 0.1.1

### Patch Changes

- 4615a9b: Update package description

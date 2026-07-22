---
"@haptiq/stylelint-config": minor
---

Lower the Node/npm engines requirement from >=24/>=11 to >=22.12.0/>=10.9.0 (and normalize to full semver). The strictest dependency, stylelint, only requires node >=20.19, so nothing is left behind.

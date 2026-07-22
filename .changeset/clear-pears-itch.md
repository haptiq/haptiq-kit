---
"@haptiq/kit": minor
---

Lower the Node/npm engines requirement from >=24/>=11 to >=22.12.0/>=10.9.0. Node 24 was never technically required — the true floor is commander@15 (node >=22.12). This restores support for the Node 22 LTS line.

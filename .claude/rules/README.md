# Path-scoped rules

Rules in this directory load when files matching their `paths` glob are in play, instead of
sitting in `AGENTS.md` and consuming attention on every task.

This is the mechanism that keeps the constitution under 200 lines. When a rule applies only to
one directory or one file type, it belongs here, not there.

Each file:

```markdown
---
description: one line, what this covers
paths: ["src/**/*.ts"]
---

Rules, as short verifiable statements.
```

`/onboard` replaces the placeholders here with real rules for the chosen stack, and deletes the
ones that do not apply.

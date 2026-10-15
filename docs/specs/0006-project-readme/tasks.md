---
type: tasks
spec: "0006"
status: done
date: 2026-10-15
---
# 0006 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | Spec approved, registered | - | `lint:docs` passes | done |
| 2 | Skill `gates-and-tracks`: move the sections, compare with the old README | 1 | Criteria 1-2 hold; each moved section equals the original | done |
| 3 | Template README to at most 140 lines | 2 | Criterion 3 holds | done |
| 4 | Stub `docs/_project-readme.md` and the `/onboard` steps | 3 | Criteria 4-6 hold | done |
| 5 | Linter checks and adapter cleanup | 3 | Criteria 7-10 hold | done |
| 6 | Tests, log, verify | 2-5 | `npm run check` (with the written ADR escape) and `test:derived` pass | done |

## Blocked

No blocked tasks.

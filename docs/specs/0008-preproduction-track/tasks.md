---
type: tasks
spec: "0008"
status: done
date: 2026-11-21
---
# 0008 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | ADR 0022, spec, registration | - | `lint:docs` passes | done |
| 2 | `/preprod` command and `preproduction` skill | 1 | Criteria 5-9 and 14 are in the procedure | done |
| 3 | `tracks.json`, `/onboard`, `/design`, `/assess`, `/harden`, marked text | 2 | Criteria 1-4, 10, 15, 16 hold | done |
| 4 | Linter gate and document types | 1 | Criteria 11-13 hold in `test:gates` | done |
| 5 | Verify | 2-4 | `npm run check` and `test:derived` pass; log entry | done |

## Blocked

No blocked tasks.

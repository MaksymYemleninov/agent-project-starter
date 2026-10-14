---
type: tasks
spec: "0003"
status: done
date: 2026-10-14
---
# 0003 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | Spec, register as template record and in the index | - | `lint:docs` passes | done |
| 2 | Heredoc handling in `parse()` with gate tests | 1 | Criteria 5-10 pass, existing guard tests unchanged | done |
| 3 | Adapter: outputs first, unchanged skipped, preflight, index order, copy hint | 1 | Criteria 1-4 pass in regression tests | done |
| 4 | Session-start warning | 1 | Criterion 11 checked | done |
| 5 | Verify | 2-4 | `npm run check` and `test:derived` pass; log entry written | done |

## Blocked

No blocked tasks.

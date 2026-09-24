---
type: tasks
spec: "0002"
status: done
date: 2026-09-24
---
# 0002 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | Spec and ADR 0016 | - | Criteria and decision recorded; both registered as template records | done |
| 2 | Policy module and gate | 1 | `docsGaps` and `escapeReason` exist; `check:docs` exits per criteria 1-4, 6, 9, 11 | done |
| 3 | ADR gate escape | 2 | Criteria 5 and 7 hold; deletions still rejected | done |
| 4 | Stop hook on the shared rule | 2 | Criterion 10 holds, covered by a test | done |
| 5 | CI and PR template | 2, 3 | Step in the required ADR drift job with `PR_BODY` and `edited`; label no longer a reason | done |
| 6 | Constitution and procedures | 2 | Principle 4, ship, harden, README describe the enforced rule | done |
| 7 | Verify | 2-6 | `npm run check` and `test:derived` pass; the PR's own CI passes | done |

## Blocked

No blocked tasks.

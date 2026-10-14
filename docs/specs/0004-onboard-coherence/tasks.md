---
type: tasks
spec: "0004"
status: done
date: 2026-10-14
---
# 0004 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | Spec approved, numbered 0004, registered | - | `lint:docs` passes | done |
| 2 | Linter: marker split, `deferred` status, `adr` check, with tests | 1 | Criteria 1-4 pass in regression tests | done |
| 3 | `onboarding.json`: `environment` key | 1 | Key present with default `null`, lint accepts it | done |
| 4 | `/onboard`: preflight, unreachable-source rule, infra criterion, protected edits, `deferred` data model, phase 7 | 2, 3 | Criteria 5-10 statements present, checked by test and in review | done |
| 5 | `infra-architect` Mode 0 wording and `writing-spec` exception | 4 | Criteria 7 and 10 hold | done |
| 6 | Verify | 2-5 | `npm run check` (with the written ADR escape) and `test:derived` pass; log entry written | done |

## Blocked

No blocked tasks.

---
type: tasks
spec: "0001"
status: done
date: 2026-09-24
---
# 0001 - Tasks

| # | Task | Depends on | Done when | Status |
|---|---|---|---|---|
| 1 | Record scope and decision | - | Spec and ADR reflect the approved scope | done |
| 2 | Capture regressions on main | 1 | Each defect has a red reproduction | done |
| 3 | Implement inventory and adapter | 2 | Ownership is complete and unsafe deletion refused | done |
| 4 | Repair gates and test isolation | 2 | ADR, copy and runner regressions pass | done |
| 5 | Verify lifecycle and review | 3, 4 | Template and derived checks pass; reviews resolved | done |

## Blocked

No blocked tasks.

## Verification

- Original main: the five defect scenarios fail (optional profiles, customized source rule,
  unstaged deletion, deleted ADR coverage and missing runner). Repeated against a separate main
  snapshot with corrected ADR fixtures that put the deleted record in the comparison base.
- Updated template: npm run check passes with 100 gate assertions and eight expected template
  warnings; the regression suite passes.
- Derived fixture: npm run check passes at exploration and building, with a warning baseline.
- No real paid agent, deployment, external scanner or application /harden approval was run.
- Code review cycle 1 found three additional defects: stage-dependent regressions, no-op fixture
  commits and URI-encoded checkout paths. Fixed them, added a checkout-with-spaces regression and
  included the full regression suite at both lifecycle stages. Cycle 2: READY, no findings.
- Scoped security review: both cycles READY, no findings. Static review only; external scanners
  and application ASVS verification were not run. No additional rule gap was identified.
- Final local verification on Node v24.19.0: npm run check (100 passed), npm run test:regressions
  (no failures), npm run test:derived (check and regressions pass at both stages), git diff --check.
- The original five defect tests were red against main commit
  `66842bee9c4053e3ff3735a32414a63939a2fb54`; new manifest/adapter tests also reject the old checkout
  because those capabilities do not exist there. This is distinct from reproducing an old bug.

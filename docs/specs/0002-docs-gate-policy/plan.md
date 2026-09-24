---
type: plan
spec: "0002"
status: done
date: 2026-09-24
---
# 0002 - Implementation plan

## Approach

One policy module, `scripts/docs-policy.mjs`, owns the rule and the escape parsing. It exposes
`docsGaps(change, gates)`, used by the Stop hook and by a new `scripts/check-docs.mjs`, and
`escapeReason(kind)`, used by the new gate and by the ADR gate. `changedFiles` already returns
statuses, so "added" is known without new git calls.

CI runs the gate as a second step of the "ADR drift" job, which is already a required check, and
both steps receive the pull request body as `PR_BODY` through `env`. The workflow listens to
`edited` so a reason added after opening re-runs the gates. The ADR gate stops reading the label; the label's only remaining use is
visibility.

Configuration moves from `stopHook.sourceFilesWithoutSpec` / `requireLogEntry` to a `docs` block in
`.claude/gates.json`, because the rule is no longer the Stop hook's alone.

## Files touched

| Path | Change | Risk |
|---|---|---|
| `scripts/docs-policy.mjs` | new: rule and escape parsing | medium |
| `scripts/check-docs.mjs` | new: CI and local gate | medium |
| `scripts/check-adr-drift.mjs` | escape via `escapeReason('adr')` | medium |
| `.claude/hooks/stop-check.mjs` | uses `docsGaps` | low |
| `scripts/changed-files.mjs`, `scripts/gate-fixture.mjs` | `docs` defaults | low |
| `.claude/gates.json`, `package.json` | `docs` block, `check:docs` | low |
| `.github/workflows/ci.yml`, `.github/pull_request_template.md` | new step in the ADR drift job, `PR_BODY`, `edited`, escape lines | medium |
| `AGENTS.md`, `README.md`, commands `ship`/`harden` | principle 4 and procedures | low |
| `scripts/test-gates.mjs`, `scripts/test-regressions.mjs` | cases for criteria 1-11 | low |

## Data changes

none

## Decisions required

- [ADR 0016](../../decisions/0016-escape-reasons-live-in-the-pull-request.md): the documentation
  rule and escape reasons in the pull request body, replacing the label as the ADR gate's escape.

## Test strategy

Gate tests run the new gate and the Stop hook against committed fixtures in the sandbox: one-file
edit, new file, threshold with and without a spec, log present and absent, reasons of valid and
short length through `PR_BODY` and through the local variables, label alone, exploration. A
regression checks that the Stop hook and the gate agree on the same change. The workflow's
`edited` trigger and `env` passing are verified by the pull request that introduces them.

## Rollout

Advisory at `exploration` like every process gate. At `building` it fails pull requests
immediately, through the already required "ADR drift" check.

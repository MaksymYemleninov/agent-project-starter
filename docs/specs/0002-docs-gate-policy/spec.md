---
type: spec
id: "0002"
status: done
date: 2026-09-24
owner: maintainers
adrs: ["0016"]
ui: false
design: null
---
# 0002 - Documentation gate in CI, with written escape reasons

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

Principle 4 of `AGENTS.md` says a behaviour change without documentation is incomplete and that
"CI enforces this". It does not: CI checks the state of the documents and, through the ADR gate,
decision-shaped files. A pull request that adds or rewrites application code with no spec and no
log entry passes CI at `building`. Only the Stop hook asks, once per session, and a review found
it is easy to walk past.

The two existing escapes are also weaker than they look. The `no-adr-needed` label switches the ADR
gate off without any reason being checked; the reason is supposed to be in the pull request
description, and nothing verifies that it is.

## Goal

CI enforces exactly what the constitution claims, with a rule proportionate enough that an honest
one-file fix passes without paperwork, and every escape carries a written reason that CI checks is
there.

## Non-goals

- A log entry for an architecture change by itself: that change already needs an ADR, which is its
  record. (The Stop hook asked for both before; it now follows this rule.)
- Judging whether documentation is good. The gate checks presence; review judges quality.
- Requiring a log entry or spec for every change.
- Changing when the ADR gate triggers, beyond how its escape is expressed.
- Branch protection settings (which checks are required) - a repository setting, not code.

## Users and triggers

A contributor or agent opening or updating a pull request; the same person running the checks or
ending a session locally.

## Acceptance criteria

1. When a pull request changes fewer source or infrastructure files than `docs.filesWithoutSpec`
   and adds none, the documentation gate shall pass without any documentation change.
2. When a pull request changes at least `docs.filesWithoutSpec` source or infrastructure files, the
   documentation gate shall fail unless a spec or an existing ADR is added or modified.
3. When a pull request adds a new source or infrastructure file, or crosses the threshold in 2, the
   documentation gate shall fail unless `docs/log.md` is modified.
4. If the pull request description contains a line `No-docs-reason:` followed by at least 20
   characters, the documentation gate shall pass and print that reason.
5. If the pull request description contains a line `No-ADR-reason:` followed by at least 20
   characters, the ADR gate shall treat its coverage triggers as justified and print that reason;
   it shall still reject forbidden ADR deletions.
6. If an escape line is present but shorter than 20 characters, the gate shall fail and say that a
   reason is required.
7. If the `no-adr-needed` label is present without an `No-ADR-reason:` line, the ADR gate shall not
   treat the label as a reason.
8. When the pull request description is edited, CI shall re-run both gates.
9. While `stage` is `exploration`, the documentation gate shall report gaps and exit successfully.
10. The Stop hook and the documentation gate shall compute documentation gaps with the same
    function, so a change that passes one passes the other.
11. When run locally, `SKIP_DOCS_CHECK` and `SKIP_ADR_CHECK` shall be accepted as the escape, with
    the same 20-character minimum.
12. The constitution's principle 4 shall state the rule CI actually enforces.

## Security

The pull request description is attacker-controlled on pull requests from forks. It is passed to
the scripts only as an environment variable, never interpolated into a shell command in the
workflow, and the scripts only search it for the two escape lines. No new permissions, secrets or
network access. An escape reason is visible in the pull request, so a reviewer can disagree with
it; the gate verifies presence, not honesty.

## Out of band

None. The gate runs as a step of the existing "ADR drift" job, which is already a required check,
so it blocks merges without a settings change.

## Open questions

- [x] Threshold: reuse the existing value, 3 files, now under `docs.filesWithoutSpec`.
- [x] Label: kept as a visible marker, but no longer a reason by itself.

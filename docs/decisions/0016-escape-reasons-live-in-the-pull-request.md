---
type: adr
id: "0016"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, tooling, ci]
supersedes: null
superseded_by: null
---
# 0016 - Enforce documentation in proportion to the change, with escape reasons in the pull request

## Context

Principle 4 of the constitution said that a behaviour change without documentation is incomplete
and that "CI enforces this". A review reproduced that it did not: a pull request adding
application code with no spec and no log entry passed every CI job at `building`. The only check
was the Stop hook, which blocks once per session by design, and the CI jobs checked decision-shaped
files, not code. The constitution promised a guarantee the gates did not give, which is worse than
promising nothing, because people and agents stop checking for themselves.

The obvious repair, "any code change needs a documentation change", fails the other way. A typo
fix would need a log entry, the log would fill with noise, and the gate would be routed around;
[ADR 0004](0004-gates-are-staged.md) already records what happens to gates that fight ordinary
work. The rule had to be proportionate, and the Stop hook and CI had to use the same one, or the
same change would pass locally and fail in CI.

The escapes had a matching weakness. The `no-adr-needed` label switched the ADR gate off, on the
understanding that the reason was in the description, and nothing checked that it was. The label
recorded that someone wanted to skip, not why. [ADR 0003](0003-run-the-adr-gate-on-pull-requests-only.md)
made the label the only escape in CI; that part is what this record replaces. The rest of ADR 0003,
running the drift gate on pull requests only, stands and applies to the new gate too.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Correct the constitution to say only the Stop hook asks | Honest, no new gate | Leaves code without documentation unenforced where it matters, in CI | Low |
| Any code change requires a `docs/` change | Simple to state and to check | Taxes every one-line fix; the log becomes noise; the gate gets bypassed | Low |
| Proportionate rule shared by hook and CI: new file needs a log line, the threshold needs a spec or ADR too; escapes as reason lines in the description | Enforces what matters, lets small fixes through, one rule in two places, reasons are checked to exist | The threshold is a guess; a reason's presence is checkable, its honesty is not | Low |
| Keep labels, add a bot that asks for a reason | Familiar | A second system to run, and still no check that the reason exists | Medium |

## Decision

We will enforce documentation in CI with `check:docs`, using one rule shared with the Stop hook
(`scripts/docs-policy.mjs`): fewer than `docs.filesWithoutSpec` changed source or infrastructure
files adding none need nothing; a new file needs a `docs/log.md` entry; reaching the threshold needs
a spec or ADR plus that entry. Both gates accept an escape only as a `No-docs-reason:` or
`No-ADR-reason:` line of at least 20 characters in the pull request description (or the matching
`SKIP_*` variable locally), re-run when the description is edited, and no longer treat a label as
a reason.

## Consequences

### Positive

- The constitution now says what CI does, and CI does it.
- A one-file fix passes with no paperwork; a new module or a wide change carries its record.
- The hook and CI cannot disagree about the same change, because they call the same function.
- Every skipped gate has a written reason in the pull request, where a reviewer can dispute it.

### Negative

- The threshold of three files is inherited from the Stop hook, not measured. A refactor touching
  ten files for one small reason needs an escape line; a sprawling change of two files needs none.
- A reason's length is checkable; its truth is not. "Refactor, no behaviour change at all here"
  passes whether or not it is true. That remains the reviewer's job, and this record says so.
- The pull request description becomes input to CI. It is attacker-controlled on forks; it is read
  only through an environment variable and only searched, never executed, but it is one more input
  to keep that way.
- Existing pull requests that relied on the label now fail until a reason line is added.
- The documentation gate runs inside the "ADR drift" job so that it is required from the start.
  A failure in that check now means either gate, and the log has to be read to tell which.
- Moves count as moves only when git's rename detection pairs them; a file rewritten while moved
  counts as new code and needs a log entry.

## Revisit when

Escape lines appear on more than a small share of pull requests, or reviewers regularly find
documentation missing on changes the gate passed. Either means the threshold or the rule is wrong.

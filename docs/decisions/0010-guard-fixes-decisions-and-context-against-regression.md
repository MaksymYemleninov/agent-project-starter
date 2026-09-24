---
type: adr
id: "0010"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, tooling, documentation]
supersedes: null
superseded_by: null
---
# 0010 - Guard fixes, decisions and context against quiet regression

## Context

The gates so far check that things are written down: a decision has substance, a document is
reachable, a spec has testable criteria. None of them notices when something that was right
stops being right later. Four versions of that failure were visible in this template's own
history and in a review of an open-source agent harness (ruflo) that had hit each one:

- **A fix is undone.** Several fixes in this repository exist because of a specific past bug:
  the Stop hook that ignored committed work, the CRLF parse failure, the untracked directory that
  hid its files. The reason lives in `docs/log.md`, which an agent editing the script does not
  read. To an agent the fix looks like complexity, and simplifying it breaks nothing visible
  until the old bug comes back. The harness reviewed kept a registry of fixes with a marker
  string per fix and failed CI when one vanished; its signing on top of that proved nothing, but
  the marker idea is sound.
- **Code drifts from an accepted decision.** The ADR gate fires when a decision-shaped file
  changes without a record. Code that quietly does what an accepted ADR rules out changes no such
  file, and no reviewer instruction asked anyone to check.
- **Warnings stop meaning anything.** Warnings print and never block. After a week they are read
  as noise, and a new one arrives unnoticed among eight old ones.
- **Compaction drops the step in flight.** After a context compaction the agent continues from a
  summary. The repository still knows the branch, the uncommitted files and the tasks marked
  `doing`, but the session start hook only ran its normal greeting.

A fifth item is prose: reports that say "configured" or "deployed" when only one narrower fact was
checked, a failure the same review showed at scale.

The constraint throughout: no new dependencies, nothing that blocks a project at `exploration`,
and every check small enough to be tested in `test-gates.mjs`.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Rely on review and the log | No machinery | The log is exactly what an agent editing a script does not read | Low |
| Test every past bug as a behavioural regression test | Strongest guarantee | Needs a test harness per script; heavy for a template with no test framework by design | Medium |
| Marker strings, a warning ratchet, an ADR compliance step in review, compaction recovery in the start hook | Cheap, testable, each fits an existing gate | Markers check presence, not behaviour; the ratchet counts rather than identifies; compliance review is judgement | Low |
| Adopt the harness's memory and learning layer for context | Richer recovery | A large runtime, unpinned code on every tool call, and claims its own audit could not substantiate | High |

## Decision

We will add four mechanisms and one rule: `markers` in `.claude/gates.json` that lint fails on
when a guarded string disappears; a warning ratchet in `.claude/lint-baseline.json`, created by
`/harden`, that fails lint when warnings rise and that `--update-baseline` only ever lowers; supersede
cycle detection in the ADR checks plus an ADR compliance section in `code-reviewer`; compaction
recovery in `session-start.mjs`; and the distinction between recording work and doing it in
principle 7 of `AGENTS.md`.

## Consequences

### Positive

- Removing a guarded fix now fails with the reason it existed, at the moment someone removes it,
  and taking the marker out is a guardrail change the ADR gate asks about.
- Accepted decisions are checked against the code that should follow them, not only against their
  own template.
- A new warning after `/harden` is an error, so the list stays short enough to read.
- After compaction the agent is told what was in flight by the repository, not by its summary.

### Negative

- A marker proves a string is present, not that the fix works. A refactor that keeps the string
  and breaks the behaviour passes, and a rename that keeps the behaviour fails until the marker
  moves.
- The ratchet counts warnings. Fixing one and adding a different one passes unnoticed, and a hand
  edit can raise the baseline; only review sees that.
- ADR compliance is a reviewer instruction, prose, and depends on the reviewer finding the right
  records by search. It is the weakest of the four.
- The shipped markers point at the template's own scripts. A derived project inherits them, which
  is right while it keeps those scripts and noise the day it rewrites one.
- Compaction recovery reads `tasks.md` rows by table shape. A tasks file written in a different
  format restores nothing, silently.

## Revisit when

A marker fails on a correct refactor more often than it catches a real regression, or the ratchet
is raised by hand more often than it is lowered. Either means the mechanism costs more than the
failure it prevents.

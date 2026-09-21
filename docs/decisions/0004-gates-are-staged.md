---
type: adr
id: "0004"
status: accepted
date: 2026-09-21
deciders: [maintainers]
tags: [process, tooling]
supersedes: null
superseded_by: null
---
# 0004 - Gates are staged, advisory before they block

## Context

The gates were built to hold from the first commit. Reviewing the template against its actual
purpose showed that this is wrong for the case it exists to serve.

The purpose is launching projects quickly with a shared structure, so that an agent opening any of
them finds the same shape. The gates as built serve a different goal: keeping a project that is
already in production from decaying. Those goals want opposite defaults.

Concretely, a project on day three has no stable architecture. Its `docs/architecture/overview.md`
gets rewritten twice a week, and each rewrite trips the drift gate and demands a decision record
about a structure that will not survive the month. The rational response is to write filler records
or to reach for the escape hatch every time, and both destroy the practice: filler makes the
directory worthless, and a routine escape makes the gate decorative. [ADR 0002](0002-configure-and-substantiate-the-gates.md)
already named a routine escape as the signal that the triggers are wrong.

The same applies to the Stop hook. Blocking a session over a missing log entry while someone is
still deciding what the product is optimizes the wrong thing.

The failure here is not in any check. It is that the checks had one setting for two situations.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep gates always on | Nothing decays, one behavior to understand | Fights exactly the week it should stay out of, and gets disabled wholesale | Low |
| Ship gates off, let people turn them on | No friction at the start | Nobody turns them on later; the default is what ships | Low |
| Two templates, one light and one strict | Each internally consistent | Two things to maintain, and a project cannot move between them | Medium |
| One flag, three stages, gates read it | Same repository throughout, friction matches the phase | A project can sit in exploration forever, which is the old "off" failure wearing a flag | Low |

## Decision

`.claude/gates.json` carries a `stage`: `exploration`, `building`, or `production`.

At `exploration` the documentation linter and the drift gate report everything they find and exit
successfully, and the Stop hook stays silent. Nothing blocks. At `building`, the normal working
state, they hold as before. `production` is currently identical to `building` and reserved for
stricter freshness rules.

`/onboard` sets `exploration` on a new project as part of the first-run reset. `/harden` moves it
to `building` and carries the checklist for doing so honestly: fix the errors that were being
reported and ignored, verify that the architecture document describes code that exists, verify that
`sourcePaths` actually matches the layout, and record the decisions made during exploration when
nothing was asking for them.

The secret guard runs at every stage. A leaked credential is not a process question, and there is
no phase of a project where reading `.env` into the transcript is acceptable.

## Consequences

### Positive

- The template now serves the case it exists for: fast start, shared structure, friction arriving
  when it earns its place.
- Errors are visible from day one even while advisory, so `/harden` is a matter of fixing a known
  list rather than discovering one.
- The transition is a documented moment with a checklist, which is where the retroactive decisions
  get written down.

### Negative

- A project can stay at `exploration` indefinitely and get none of the protection. That is the
  "gates off" failure mode with extra steps, and nothing here prevents it. Only the human running
  `/harden` does, and nothing reminds them except the stage line printed by the linter.
- Two behaviors mean the same command gives different answers in different repositories. Someone
  debugging "why did this pass" now has to check the stage first. The linter prints it for that
  reason.
- Errors that are reported and never block get read as noise within about a week. The advisory
  period is only useful if it is short.
- `production` exists in the enum while being identical to `building`, which is a promise the code
  does not yet keep.

### Follow-ups

- Have the linter warn when a project has been at `exploration` for more than a month, so drifting
  there forever is at least visible.
- Give `production` real meaning or remove it from the enum.

## Revisit when

A project reaches production while still at `exploration`. That means the transition never happens
on its own and needs a harder prompt than a printed line.

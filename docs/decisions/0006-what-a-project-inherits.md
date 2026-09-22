---
type: adr
id: "0006"
status: accepted
date: 2026-09-22
deciders: [maintainers]
tags: [process, tooling]
supersedes: null
superseded_by: null
---
# 0006 - Decide deliberately what a derived project inherits

## Context

The template was used end to end for the first time, and the result was measured rather than
guessed. Two numbers stood out.

Of the fourteen decision records in that project, six were inherited from the template and described
how the template's own gates were built. Nearly half the reasoning a reader walks through before
reaching anything about the product was about tooling, and about tooling's history rather than its
behaviour. That is a tax paid by every project this template will ever produce.

Separately, two documents shipped as content, `architecture/integrations.md` and `ops/runbook.md`,
were never filled and produced a warning on every lint run for the life of the project. A warning
that never goes away stops being read, and it takes the warnings that matter with it.

Both are the same mistake in different places: shipping something as though the project has it,
when the project does not have it yet and may never.

A third, related finding: the gate configuration shipped defaults describing a JavaScript layout.
On a Python project `sourcePaths` matched nothing, so the Stop hook noticed no source change at all
and reported success while doing it. [ADR 0002](0002-configure-and-substantiate-the-gates.md) had
named exactly this as a follow-up and it had not been done.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Ship everything, let projects delete what they do not want | Nothing to design | Deleting requires knowing it is safe to delete; nobody deletes what they do not understand | Low |
| Ship nothing, generate everything at onboarding | Cleanest possible project | The shapes are lost, and onboarding has to invent a document format under time pressure | Medium |
| Mark stubs by convention, rename into place when needed | Shapes preserved, project stays clean, one rule to learn | A convention to remember, and a file that looks like a document but is not | Low |
| Keep the inherited records, add a note saying to ignore them | No work | Asking a reader to ignore half a directory does not work | Low |

## Decision

**A leading underscore marks a template stub.** It is a starting shape, not a document the project
has. The linter ignores stubs entirely: not required to be reachable, no status, not validated as
an ADR or spec. The phase or command that knows the project needs one renames it into place.

Three stubs ship: `docs/decisions/_template.md` as before, plus
`docs/architecture/_integrations.md`, renamed in onboarding phase 5 if the project reads external
services, and `docs/ops/_runbook.md`, renamed by `/harden` once there has been a deploy worth
writing down.

**A derived project inherits one decision record, not six.** Onboarding keeps `0000`, which
establishes the practice and applies everywhere, deletes `0001` through `0005`, which are the
template's construction history, and renames `_inherited-tooling.md` into place as `0001`. That
record summarises what the gates do and why, at the level a reader needs in order to decide whether
to follow them, and links the originals. Project records start at `0002`.

**The linter warns when `sourcePaths` matches nothing at all.** One warning, not one per glob, and
only for `sourcePaths`: `manifests` deliberately lists several ecosystems and most will never match,
so warning per entry would bury the signal under its own noise.

## Consequences

### Positive

- A derived project's decision record is about that project from its second entry onward.
- The lint output has no permanent residue, so a warning appearing means something changed.
- The silent mis-gating that ADR 0002 predicted is now visible, and visible before it matters:
  the warning fires on an empty project too, where it is expected.

### Negative

- The inherited record is a summary, and summaries drift from what they summarise. If the template
  changes a gate's behaviour, every project created before that change describes it slightly wrongly
  and nothing detects the divergence.
- Five separately supersedable decisions became one. A project that wants to change a single
  inherited behaviour now supersedes a record that also asserts four other things.
- The underscore convention is invisible until explained. A file named `_runbook.md` looks like a
  document with a typo, and the explanation lives in onboarding's phase 0 text, which is read once.
- Deleting the template's own records during onboarding is the one place where this system
  deliberately destroys decision records. It is defensible because they survive in the template
  repository, and it is still an exception to a rule stated absolutely in ADR 0000.

### Follow-ups

- Nothing checks that the inherited summary still matches the gates it describes. If the template's
  behaviour changes materially, that divergence is found by a person or not at all.

## Revisit when

A second and third project exist and it becomes clear whether the inherited summary is read at all.
If it is not, the honest move is to drop it rather than keep shipping a record nobody opens.

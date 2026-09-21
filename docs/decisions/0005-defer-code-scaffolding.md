---
type: adr
id: "0005"
status: accepted
date: 2026-09-21
deciders: [maintainers]
tags: [process, tooling, testing]
supersedes: null
superseded_by: null
---
# 0005 - Defer test setup and code CI until there is code

## Context

Onboarding created a test runner with one passing test, and a CI job to run it, before the product
existed. Questioned on why, the honest answer did not survive contact with the evidence.

The test in question asserts that a scaffolded health endpoint returns `200`. It tests the
scaffold, not the product, and it is deleted the same week the first real feature lands. Its value
is proving the test runner is installed, which is a fact about the machine rather than about the
code.

The CI job was measurably worse. On the template's own repository it ran on every push and spent
around twenty seconds printing that there was no lockfile and no test script, then passed. A check
that always passes vacuously is indistinguishable, from the outside, from a check that is broken:
both are green, and neither tells you anything. This repository already recorded the same reasoning
about a check that always fails in [ADR 0003](0003-run-the-adr-gate-on-pull-requests-only.md); the
mirror case had gone unnoticed.

There is also an inconsistency to own. [ADR 0004](0004-gates-are-staged.md) argued that a project
still finding its shape should not be held to the discipline of one that is finished, and made the
gates advisory for exactly that reason. Then onboarding scaffolded that same discipline into the
code side on day one. The argument was made and not carried through.

The counter-argument is real and should not be waved away: deferring tests is the single most
common route to a project that never has any. "We will add tests later" is how it starts every
time.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep it as built | Tests and CI exist from commit one; nobody can claim they were skipped | Tests the scaffold, CI passes vacuously, both get deleted or ignored | Low |
| Drop test setup and CI entirely, mention them in a best-practices document | Zero day-one friction | A best-practices document is a place things go to be unread; deferral becomes abandonment | Low |
| Defer both to the first feature, with a required checkpoint | The decision is made when the shape is known; the checkpoint prevents drift into never | Depends on the checkpoint actually being run | Low |
| Ask during onboarding whether to scaffold tests | Explicit choice | A question nobody has the information to answer yet, in the phase already asking the most | Low |

## Decision

Phase 6 of onboarding proves the toolchain and nothing more: a skeleton that runs, one visible
endpoint or page, linter and formatter, `.env.example`, and the real commands written into
`AGENTS.md`. It does not install a test framework.

The testing approach is decided in the first spec's `plan.md`, in the Test strategy section that
already exists there, because by then there is a feature whose shape determines whether the useful
tests are unit, integration or end to end. Setting up the framework becomes the first task in that
spec's `tasks.md`.

Code CI ships as `.github/workflows/code.yml.example`. GitHub ignores it because of the extension;
renaming it to `code.yml` activates it, and that rename is a task in the same spec. The workflow
file is kept rather than deleted so the knowledge of what it should contain does not have to be
reconstructed.

Documentation CI keeps running from day zero. Unlike code, documents exist on day zero, so the
question it asks is answerable.

`/harden` requires a test command that exists, runs, and demonstrably fails when the code is wrong,
plus `code.yml` activated. This is where the deferral is paid off, and it is a hard requirement
rather than a suggestion.

## Consequences

### Positive

- Nothing in the initial commit exists only to be deleted.
- The testing decision is made with knowledge of what is being tested instead of at the moment of
  least information.
- CI is green because it checked something, not because it had nothing to check.
- Consistent with ADR 0004: friction arrives when it earns its place.

### Negative

- This makes it easier to end up with no tests. The mitigation is the `/harden` checklist, and
  ADR 0004 already conceded that nothing forces `/harden` to be run. So the honest statement is
  that this decision moves a guarantee into a convention, and conventions decay.
- A project that never reaches `/harden` now has neither advisory gates that matter nor tests. The
  two deferrals compound, and they were decided separately without noticing that.
- `code.yml.example` is a file that does nothing, which is its own small confusion. The header
  comment carries the instruction, and a header comment is read only by someone already looking at
  the file.
- Someone comparing two projects from this template will find different CI depending on how far
  each has got, which makes "structurally identical" less true than it was.

### Follow-ups

- Have the documentation linter warn when a project has source files but no test command in the
  `AGENTS.md` Commands table. That converts the convention back into something mechanical, and it
  is the obvious next step if this decision turns out to cost tests.

## Revisit when

A project built from this template reaches production without tests. That is this decision failing
in the exact way its negative section predicts, and the fix is the linter warning above rather than
returning to day-one scaffolding.

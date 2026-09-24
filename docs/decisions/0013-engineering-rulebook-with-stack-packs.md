---
type: adr
id: "0013"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, code-quality]
supersedes: null
superseded_by: null
---
# 0013 - Write code to a rulebook with stack packs, enforced by tools first

## Context

The template deliberately picks no stack, and until now it said almost nothing about how code
should be written: a placeholder `source.md` with six generic lines, which onboarding was told to
replace "with real stack rules" and given no material to do it from. An agent asked to write rules
for a stack under time pressure produces generic advice, and an agent writing code with no rules
produces whatever its training data averaged to: layers that exist for their own sake, validation
scattered through the call graph, errors logged at every level, configuration read wherever it is
needed.

The owner named the stacks their projects actually use: TypeScript, Next.js, Python and Go. That
makes it possible to ship concrete packs rather than principles alone, and to name real tools
(strict compiler flags, lint rule sets, a boundary checker per ecosystem) instead of "configure a
linter".

The deeper constraint is the one this template keeps meeting: prose rules fade in a long session
([ADR 0001](0001-enforce-documentation-in-ci.md)). A rule about import direction written as a
sentence is broken within a week; the same rule as a boundary-checker contract fails the build.
So each rule had to say which it is, a tool rule or a review rule, and the tool rules had to become
configuration, not text.

Next.js specifically moves fast enough that remembered rules are wrong: while writing the pack, the
file previously called `middleware.ts` turned out to be `proxy.ts` since version 16, with the
documentation now saying outright not to rely on it for authorization. That was checked, not
recalled, and the pack tells the reader to do the same.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep the placeholder; onboarding writes rules from nothing | Nothing to maintain | Generic rules written under time pressure, different in every project | Low |
| Adopt an external style guide per language wholesale | Authoritative, maintained by others | Mostly formatting and naming, which the formatter already settles; silent on boundaries, errors and validation | Low |
| One rulebook: principles plus a pack per stack, each rule marked tool or review, tools configured at onboarding, packs not used deleted | Concrete, enforced where it can be, reviewed where it cannot, same shape in every project | Four packs to keep current; a pack can age quietly | Low |
| Generated per project by an agent from current documentation | Always current | Unreviewed text as the standard, and a different standard each time | Low |

## Decision

We will ship `engineering-rulebook` with stack-agnostic principles and packs for TypeScript,
Next.js, Python and Go; mark every rule as enforced by a tool or checked in review; have onboarding
turn the tool rules into configuration (strict types, lint with complexity limits, formatter, a
boundary checker carrying the boundaries from `docs/architecture/overview.md`), write the review
rules into a path-scoped rule file, and delete unused packs; make `code-reviewer` check the review
rules; run the mechanical floor in `code.yml`; and warn when a placeholder rule or skill survives
onboarding.

## Consequences

### Positive

- The architecture in `overview.md` is enforced by the build from phase 6, not by memory.
- Every project on the same stack starts from the same strictness, layout and conventions.
- The reviewer's time goes to what tools cannot see, and it can cite a rule rather than a taste.
- A project that skipped writing its rules is told so by the linter instead of drifting silently.

### Negative

- Four packs to maintain. Tool names and rule identifiers were checked while writing, but tools
  change; a pack is right on the day it was written, and nothing detects it ageing except the
  first onboarding that fails to apply it.
- The packs make choices (uv, Ruff, Vitest, Zod, golangci-lint) that some teams will not share.
  Changing one is an ADR in the derived project, which is the right friction but is friction.
- Complexity limits and strict flags slow the first week of a prototype. Loosening one needs an
  `[OVERRIDE]` with a reason, and a prototype may collect several.
- The boundary checker only knows the boundaries someone wrote into `overview.md`. An architecture
  that was never written down is not protected.
- Only the Node job in `code.yml.example` is live YAML; Python and Go are commented variants that
  onboarding must uncomment correctly.

## Revisit when

A derived project reports that a pack rule was wrong for its stack, or a tool the pack names is
deprecated. Fix the pack in the template, and note it in the pack so older projects can check.

---
type: adr
id: "0015"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [tooling, onboarding, testing]
supersedes: null
superseded_by: null
---
# 0015 - Share template track ownership

## Context

The template passes its own suite but a project following onboarding removes agent profiles and
replaces placeholders that those tests require. Instructions and tests currently describe two
separate versions of what a derived project inherits. Adding another lifecycle checklist would
repeat that duplication. The user approved a complete ownership manifest and a shared adapter,
with mechanics repaired in this change and documentation policy deferred to a separate change.
Template implementation specs must also be removed during onboarding, or the remedy carries the
same unrelated history that ADR 0006 removed from derived decision records.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep removal instructions and tests separate | Minimal tooling | Two inventories continue to drift | Low |
| List only optional removals | Small manifest | Unregistered additions remain invisible | Low |
| Complete manifest and shared adapter | Ownership is checked; onboarding and tests agree | More entries to maintain and a deletion interface to validate | Medium |

## Decision

We will use `.claude/tracks.json` as the complete ownership inventory shared by onboarding,
manifest linting and disposable lifecycle tests.

Core and enabled tracks own exact files, scope profiles and plugins. Stack packs are tracks.
The manifest registers template records by kind, id and exact path, including this ADR and its
implementation spec. ADR cleanup exceptions consult the base manifest and require onboarding
not to be completed; deleting any other ADR is a separate violation, not decision coverage.
[OVERRIDE: onboarding cleanup] Only registered template history may be removed by this workflow.

## Consequences

### Positive

- A new unregistered item fails manifest validation before it reaches a derived project.
- Mechanism tests use fixtures; configuration tests check only the enabled project surface.
- A derived-project test exercises the same removal implementation as onboarding.

### Negative

- Maintainers must register new files and track ownership along with implementation changes.
- The adapter must validate paths and symlinks because its approved operation removes files.
- Lifecycle fixtures prove mechanical checks, not that a real application's deployment or
  security controls are configured, reachable or healthy.

### Follow-ups

- Implement [spec 0001](../specs/0001-template-lifecycle/spec.md).
- Change documentation thresholds and PR exception policy in a separate ADR and pull request.

## Revisit when

A track requires migrations or remote actions rather than local file and configuration changes.

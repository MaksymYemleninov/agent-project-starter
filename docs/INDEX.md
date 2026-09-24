# Documentation Index

Entry point for humans and agents. Every file under `docs/` must be listed here.
`npm run lint:docs` fails on any document that is missing from this index.

## Product

- [Vision](product/vision.md) - what this is and why it should exist.
- [Scope](product/scope.md) - what the first releasable version includes.
- [Non-goals](product/non-goals.md) - what it deliberately does not do. Binding.
- [Personas](product/personas.md) - who it is for.

## Specs

One directory per feature under `specs/`, numbered. Each holds `spec.md` (what and why),
`plan.md` (how) and `tasks.md` (ordered work).

- [Spec template](specs/_template/spec.md) - copy this for a new feature.

<!-- specs:list -->
No feature specs yet. `/spec` adds them here.
<!-- /specs:list -->

## Decisions

Architecture decision records. Append-only: a wrong decision is superseded, never edited away.

- [ADR template](decisions/_template.md)
- [Inherited tooling stub](decisions/_inherited-tooling.md) - `/onboard` renames this into place on a
  new project, replacing records `0001`-`0009` below, which are this template's own history
- [0000 - Record architecture decisions](decisions/0000-record-architecture-decisions.md) - accepted
- [0001 - Enforce documentation in CI, not in prose](decisions/0001-enforce-documentation-in-ci.md) - accepted
- [0002 - Configure the gates, and check ADR substance](decisions/0002-configure-and-substantiate-the-gates.md) - accepted
- [0003 - Run the ADR gate on pull requests only](decisions/0003-run-the-adr-gate-on-pull-requests-only.md) - accepted
- [0004 - Gates are staged, advisory before they block](decisions/0004-gates-are-staged.md) - accepted
- [0005 - Defer test setup and code CI until there is code](decisions/0005-defer-code-scaffolding.md) - accepted
- [0006 - Decide deliberately what a derived project inherits](decisions/0006-what-a-project-inherits.md) - accepted
- [0007 - Ship infrastructure as an optional track built on specs and ADRs](decisions/0007-optional-infrastructure-track.md) - accepted
- [0008 - Hold agents to their lane by hook, and refuse infrastructure mutation at every stage](decisions/0008-scope-agents-and-refuse-infrastructure-mutation.md) - accepted
- [0009 - Move five working patterns from the infrastructure pipeline into the constitution](decisions/0009-working-patterns-in-the-constitution.md) - accepted

<!-- decisions:list -->
<!-- /decisions:list -->

## Architecture

- [Overview](architecture/overview.md) - components and how they fit.
- [Data model](architecture/data-model.md) - entities and relationships.

## Operations

- [Environments](ops/environments.md) - environments, configuration and secret handling.

## Journal

- [Change log](log.md) - chronological record of what changed and where.
- [Idea](idea.md) - the original raw idea. Historical, never rewritten.

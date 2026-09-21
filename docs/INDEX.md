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
- [0000 - Record architecture decisions](decisions/0000-record-architecture-decisions.md) - accepted
- [0001 - Enforce documentation in CI, not in prose](decisions/0001-enforce-documentation-in-ci.md) - accepted
- [0002 - Configure the gates, and check ADR substance](decisions/0002-configure-and-substantiate-the-gates.md) - accepted
- [0003 - Run the ADR gate on pull requests only](decisions/0003-run-the-adr-gate-on-pull-requests-only.md) - accepted
- [0004 - Gates are staged, advisory before they block](decisions/0004-gates-are-staged.md) - accepted
- [0005 - Defer test setup and code CI until there is code](decisions/0005-defer-code-scaffolding.md) - accepted

<!-- decisions:list -->
<!-- /decisions:list -->

## Architecture

- [Overview](architecture/overview.md) - components and how they fit.
- [Data model](architecture/data-model.md) - entities and relationships.
- [Integrations](architecture/integrations.md) - external services and contracts.

## Operations

- [Environments](ops/environments.md) - environments, configuration and secret handling.
- [Runbook](ops/runbook.md) - deploy, rollback, common failures.

## Journal

- [Change log](log.md) - chronological record of what changed and where.
- [Idea](idea.md) - the original raw idea. Historical, never rewritten.

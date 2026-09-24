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
- [0001 - Template lifecycle](specs/0001-template-lifecycle/spec.md) - done
- [0001 plan](specs/0001-template-lifecycle/plan.md)
- [0001 tasks](specs/0001-template-lifecycle/tasks.md)
- [0002 - Documentation gate policy](specs/0002-docs-gate-policy/spec.md) - done
- [0002 plan](specs/0002-docs-gate-policy/plan.md)
- [0002 tasks](specs/0002-docs-gate-policy/tasks.md)
<!-- /specs:list -->

## Decisions

Architecture decision records. Append-only: a wrong decision is superseded, never edited away.

- [ADR template](decisions/_template.md)
- [Inherited tooling stub](decisions/_inherited-tooling.md) - `/onboard` renames this into place on a
  new project, replacing records registered template records below, which are this template's own history
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
- [0010 - Guard fixes, decisions and context against quiet regression](decisions/0010-guard-fixes-decisions-and-context-against-regression.md) - accepted
- [0011 - Repair failing tests in a loop whose limits live outside the agent](decisions/0011-bounded-repair-loop.md) - accepted
- [0012 - Design security in from onboarding, and review it separately from code](decisions/0012-security-designed-in.md) - accepted
- [0013 - Write code to a rulebook with stack packs, enforced by tools first](decisions/0013-engineering-rulebook-with-stack-packs.md) - accepted
- [0014 - Approve a design system before frontend work, and hold code to its tokens](decisions/0014-design-before-frontend.md) - accepted

<!-- decisions:list -->
- [0015 - Share template track ownership](decisions/0015-share-template-track-ownership.md) - accepted
- [0016 - Enforce documentation in proportion to the change, with escape reasons in the pull request](decisions/0016-escape-reasons-live-in-the-pull-request.md) - accepted
- [0017 - Add a NestJS and Nuxt stack pack built on CleanSlice](decisions/0017-nestjs-nuxt-pack-on-cleanslice.md) - accepted
<!-- /decisions:list -->

## Architecture

- [Overview](architecture/overview.md) - components and how they fit.
- [Data model](architecture/data-model.md) - entities and relationships.

## Operations

- [Environments](ops/environments.md) - environments, configuration and secret handling.

## Security

- [Threat model](security/_threat-model.md) - stub; `/onboard` phase 3 renames it to
  `threat-model.md` and fills it. Assets, entry points, threats, controls, abuse cases.

`/security` adds dated audit reports here.

## Design

`/design` writes `design/system.md` here once there is a UI to design: direction, principles, token
rationale, component inventory and the prototypes' index. Tokens and prototypes live in `design/`
at the repository root.

## Journal

- [Change log](log.md) - chronological record of what changed and where.
- [Idea](idea.md) - the original raw idea. Historical, never rewritten.

---
type: architecture
status: template
last_verified: 2026-09-18
---
# Architecture Overview

> TEMPLATE. `/onboard` fills this from the stack ADRs.
> Changing this file without adding an ADR fails `npm run check:adr`.

## Components

| Component | Responsibility | Owns | Does not own |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

## Request path

Walk one representative request from entry to storage and back. Name the actual modules.

## Boundaries

The rules that keep components from growing into each other. These are the ones an agent will
violate first if they are not written down.

- TBD

## Decisions behind this shape

Link every ADR that constrains this page. If a reader cannot get from here to the reasoning,
the reasoning will be refactored away.

- [ADR 0000](../decisions/0000-record-architecture-decisions.md)

## Template tooling boundary

Before onboarding, the template owns `.claude/tracks.json`. `scripts/tracks.mjs` validates its
complete ownership inventory; `scripts/adapt-template.mjs` applies approved local cleanup.
Onboarding and the disposable lifecycle test use that same adapter. Gate mechanism fixtures
are separate from the project's enabled profiles. See [ADR 0015](../decisions/0015-share-template-track-ownership.md).
Onboarding replaces this template overview with the project's architecture.

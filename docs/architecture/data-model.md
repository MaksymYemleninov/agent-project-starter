---
type: architecture
status: template
last_verified: 2026-09-18
---
# Data Model

> TEMPLATE. Filled once persistence is chosen.

## Entities

| Entity | Key fields | Lifecycle | Owned by |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

## Relationships

Describe cardinality and, more importantly, what deletes cascade to.

## Invariants

Statements that must be true at all times. These belong in tests, not only here.

- TBD

## Migrations

How schema changes are applied, reviewed and rolled back. Migrations are an irreversible action
under `AGENTS.md` section 2.6 and need explicit human confirmation.

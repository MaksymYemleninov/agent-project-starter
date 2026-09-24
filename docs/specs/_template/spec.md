---
type: spec
id: "NNNN"
status: draft
date: YYYY-MM-DD
owner: TBD
adrs: []
---
# NNNN - Feature name

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.
Every spec links these two, which is also how the documentation linter reaches them.

## Problem

What the user cannot do today, stated from the user's side. No solution language here.

## Goal

The observable change. One sentence.

## Non-goals

What this spec explicitly does not address, so the implementing agent does not wander.

## Users and triggers

Who hits this and in what moment.

## Acceptance criteria

Written in EARS form. Every criterion must be mechanically checkable, which means a test can be
written from it without asking a question. The five patterns:

- **Ubiquitous:** The system shall `<response>`.
- **Event-driven:** When `<trigger>`, the system shall `<response>`.
- **State-driven:** While `<state>`, the system shall `<response>`.
- **Unwanted behavior:** If `<condition>`, then the system shall `<response>`.
- **Optional feature:** Where `<feature is included>`, the system shall `<response>`.

Criteria:

1. When a user submits the form with a valid email, the system shall create an account and
   return `201`.
2. If the email is already registered, then the system shall return `409` and shall not create
   a second account.
3. While the account is unverified, the system shall reject login attempts with `403`.

Replace the three examples above. `npm run lint:docs` checks that at least one criterion starts
with `When`, `While`, `If`, `Where` or `The system shall`.

## Security

What this changes for the threat model (`docs/security/threat-model.md`): new entry points, data
stored or exposed, roles, integrations. Then the abuse cases as `If ...` criteria in the list
above, so they get tested. If it changes nothing, say why in one sentence: "Read-only view of
data the user already owns, behind the existing session check." `npm run lint:docs` rejects an
approved spec with this section empty.

## Out of band

What has to be true outside the code for this to work: a DNS record, a vendor account, a
migration, a feature flag.

## Open questions

Questions that block implementation. An empty list here and `status: approved` is the signal
that an agent may start.

- [ ] TBD

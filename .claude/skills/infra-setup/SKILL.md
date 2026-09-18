---
name: infra-setup
description: How this project is deployed, configured and operated. Use when touching CI, deployment, environments or infrastructure. PLACEHOLDER until /onboard fills it from the chosen hosting.
---

# Infrastructure

> **Placeholder.** `/onboard` fills this from the hosting and deployment ADRs, or deletes this
> skill if deployment is a single managed command that needs no procedure.

## Environments

What exists, what each is for, what is different between them. Point at
`docs/ops/environments.md` rather than duplicating the table.

## Deploy

The exact command sequence, what it does, how long it takes, and how to tell it worked.

## Rollback

The command that undoes it, and how long that takes. Write this before the first deploy, not
after the first incident. An untested rollback is a hope.

## Configuration and secrets

Every setting comes from an environment variable. `.env.example` lists all of them with safe
placeholders and one-line descriptions, and is committed. Real values live in the secret manager
named in `docs/ops/environments.md`.

Agents must never read, print or write real secret values. If a task appears to need one, stop
and ask.

## Irreversible operations

These always need explicit human confirmation in the conversation, and must never be chained
into a script to avoid the prompt:

- deploying to production,
- running a migration,
- deleting data or a resource,
- rotating a credential,
- changing DNS,
- anything that costs money at a new order of magnitude.

## Cost

What drives the bill, and the rough number at current usage. A change that multiplies the cost is
a decision and needs an ADR.

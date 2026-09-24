---
type: ops
status: template
last_verified: 2026-09-18
---
# Environments

> TEMPLATE. Filled by `/onboard` once hosting is chosen.

| Environment | Purpose | URL | Deployed from | Who can deploy |
|---|---|---|---|---|
| local | development | http://localhost:PORT | working tree | anyone |
| TBD | TBD | TBD | TBD | TBD |

## Infrastructure

Only when the project owns infrastructure code; delete this section otherwise. Filled by
`infra-bootstrap` from the accepted ADRs.

- IaC tool and version pin: TBD.
- State backend, encryption and locking: TBD.
- Who runs `apply`, and from where: TBD. Never an agent.
- Cloud accounts or projects per environment: TBD.

## Configuration

Configuration is read from environment variables. `.env.example` lists every variable with a
safe placeholder value and a one-line description. It is committed; `.env` never is.

## Secrets

- Secret manager: TBD.
- Rotation: TBD.
- Agents must never read, print, or write real secret values. If a task appears to require one,
  stop and ask.

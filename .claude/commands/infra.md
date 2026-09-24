---
description: Infrastructure entry point. Bootstraps it if there is none, otherwise sizes and runs the change.
argument-hint: "<what you want, in a few words>"
---

# Infrastructure

Request: **$ARGUMENTS**

1. Check whether infrastructure code exists: anything under `infra/`, or matching `infra.paths` in
   `.claude/gates.json`.
   !ls infra 2>/dev/null | head -20
2. None, or the request is a new environment, region or account: follow
   `.claude/skills/infra-bootstrap/SKILL.md`.
3. Otherwise: follow `.claude/skills/infra-change/SKILL.md`, starting with its triage.
4. If the project's hosting ADR says it runs on a managed platform with no infrastructure code,
   say so and point at `.claude/skills/infra-setup/` instead. Do not introduce IaC without an ADR
   deciding to.

Agents plan and write; the human applies. `apply`, `destroy`, `import` and state moves are refused
for agents by the `pre-bash` hook at every stage.

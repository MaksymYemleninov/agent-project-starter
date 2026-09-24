---
description: Rules for infrastructure code, CI and deployment files. The IaC rules hold as shipped; /onboard adapts the CI and hosting lines to the chosen platform.
paths:
  - ".github/**/*"
  - "infra/**/*"
  - "deploy/**/*"
  - "Dockerfile"
  - "docker-compose*.yml"
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/*.hcl"
---

# Infrastructure rules

- The full standard is `.claude/skills/infra-rulebook/SKILL.md`. Read it before writing or
  reviewing IaC. Non-trivial infrastructure work goes through `/infra`, not ad hoc edits.
- **Agents never run `apply`, `destroy`, `import` or state-moving commands.** The `pre-bash` hook
  refuses them at every stage. Run `plan`, then hand the human the exact command and the plan
  summary, with every destroy or replace named.
- Versions of modules, providers, charts and CLIs are resolved from their source when chosen,
  never written from memory. Record where each came from.
- An error that names a credential, a binary, the network or the backend is an environment error:
  stop and report it verbatim. Do not change code to get around it.
- State, plans and `.tfvars` with real values never enter the repository. They are in
  `.gitignore` and `secretPaths`.
- Changing an infrastructure foundation (state backend, root configuration, an environment,
  account or region file; `infra.foundations` in `.claude/gates.json`) is a decision:
  `npm run check:adr` asks for the record.
- Never weaken or remove a CI gate to make a build pass. Fix the cause, or get explicit agreement
  from the human to change the gate, recorded as an ADR.
- Every configuration value is an environment variable, documented in `.env.example` with a safe
  placeholder.
- Pin versions. Unpinned toolchain versions turn a passing build into a time bomb.

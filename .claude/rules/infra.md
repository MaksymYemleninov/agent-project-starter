---
description: Rules for CI, deployment and infrastructure files. PLACEHOLDER, /onboard adapts this to the chosen hosting.
paths: [".github/**", "infra/**", "deploy/**", "Dockerfile", "docker-compose*.yml", "*.tf"]
---

# Infrastructure rules

> **Placeholder.** `/onboard` adapts this to the chosen hosting and CI.

- Never weaken or remove a CI gate to make a build pass. Fix the cause, or get explicit agreement
  from the human to change the gate, recorded as an ADR.
- Deploy, migrate, delete and credential rotation always need explicit confirmation in the
  conversation. Never wrap them in a script to avoid the prompt.
- Every configuration value is an environment variable, documented in `.env.example` with a safe
  placeholder.
- Pin versions. Unpinned toolchain versions turn a passing build into a time bomb.
- Infrastructure changes are architecture changes: `npm run check:adr` will ask for the decision
  record, and it is right to.

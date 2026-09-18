---
description: Rules for application source code. PLACEHOLDER, /onboard replaces this with real stack rules.
paths:
  - "src/**/*"
  - "app/**/*"
  - "lib/**/*"
  - "server/**/*"
  - "packages/**/*"
---

# Source code rules

> **Placeholder.** `/onboard` rewrites this for the chosen stack: language version, module
> boundaries, error handling convention, logging, dependency injection, whatever actually applies.
> Delete anything below that this project does not do.

Until then, the defaults that hold regardless of stack:

- Respect the boundaries in `docs/architecture/overview.md`. Crossing one is a decision, not a
  shortcut, and needs an ADR.
- No secrets in code, in logs, or in error messages.
- Validate input at the trust boundary, once, and trust it inward. Validating everywhere means
  validating nowhere consistently.
- Errors carry enough context to act on and never swallow the cause.
- A new runtime dependency is a decision. Check for an ADR before adding one.
- Prefer extending an existing module over adding a parallel one with a similar name. Two modules
  that do almost the same thing is how a codebase becomes unmaintainable.

# Change Log

Journal of operations, not a second place to store knowledge. One entry per meaningful change:
3 to 6 bullets, each answering "what changed and where", linking to the spec or ADR that holds
the actual content.

Newest entry on top.

## 2026-09-18 - Gates reviewed and hardened

- Stop hook now sees committed work, not only the working tree; it had been missing the normal
  path, where an agent commits and then stops.
- Hook and CI gate share one definition of "changed" in `scripts/changed-files.mjs`; they had
  computed it separately and disagreed.
- Hooks anchor to `CLAUDE_PROJECT_DIR`, so they no longer go silent when run from a subdirectory.
- Guardrail files now trigger the ADR gate, recorded in
  [ADR 0001](decisions/0001-enforce-documentation-in-ci.md).
- Linter normalizes line endings; a Windows checkout would have reported every document malformed.

## 2026-09-18 - Repository initialized

- Created the agent-native skeleton: constitution, path rules, skills, subagents, commands.
- Added documentation gates: `scripts/lint-docs.mjs`, `scripts/check-adr-drift.mjs`, CI workflow.
- Seeded [ADR 0000](decisions/0000-record-architecture-decisions.md) to establish the decision
  record practice.
- Product, architecture and ops documents are templates until `/onboard` runs.

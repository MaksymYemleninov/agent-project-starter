# Change Log

Journal of operations, not a second place to store knowledge. One entry per meaningful change:
3 to 6 bullets, each answering "what changed and where", linking to the spec or ADR that holds
the actual content.

Newest entry on top.

## 2026-09-21 - First remote push, and the gate asked an unanswerable question

- First push to a remote turned `main` red. Not a script bug: on a `push` event there is no pull
  request, so neither escape from the drift gate reaches it, and the failure had no available fix.
- Drift gate moved to `pull_request` only, as its own job. Doc lint and the gate test suite keep
  running on every push. Reasoning in [ADR 0003](decisions/0003-run-the-adr-gate-on-pull-requests-only.md).
- The residual hole, a direct push to `main`, belongs to branch protection, not to the gate.
- Found by pushing, not by reading. Three days of local green said nothing about this.

## 2026-09-21 - Onboarding numbering and inherited history

- `/onboard` told the agent to number decisions from `0001`, which collides with the three ADRs the
  template ships. It now takes the next free number.
- Added a first-run reset step: `docs/log.md` is replaced with a single entry, while the gate ADRs
  are deliberately kept, because they explain the tooling the new project inherits.
- Specs still start at `0001`; the template ships none, so there is nothing to collide with.
- Found by reading the command against the repository before the first real run, not by running it.
- `/onboard` now commits once per phase instead of once at the end, so a wrong stack choice in
  phase 4 can be undone without losing the product documents from phase 3.

## 2026-09-18 - Gates made configurable and substance-checked

- Gate tuning moved to `.claude/gates.json`; the hardcoded source paths only matched JavaScript
  layouts, so the Stop hook was blind on any other stack.
- ADR linter now enforces a substance floor: real Context, two options, a negative consequence,
  no template placeholders. Details in [ADR 0002](decisions/0002-configure-and-substantiate-the-gates.md).
- New `PreToolUse` hook denies shell commands touching secret-bearing paths, closing the route
  around the `Read` deny rule.
- `/onboard` checkpoints into `.claude/onboarding.json` and resumes instead of restarting.
- Required documents split into a structural core and an expected set that only warns.

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

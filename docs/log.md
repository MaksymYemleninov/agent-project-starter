# Change Log

Journal of operations, not a second place to store knowledge. One entry per meaningful change:
3 to 6 bullets, each answering "what changed and where", linking to the spec or ADR that holds
the actual content.

Newest entry on top.

## 2026-09-21 - Gate tests assumed the host project's stage

- `test-gates.mjs` inherited `stage` from the project under test, so all eight blocking assertions
  failed on the first real project built from this template, which sits at `exploration` where the
  gates deliberately exit 0.
- The suite now forces `building` in its sandbox for the blocking cases; the explicit exploration
  cases set and restore the stage themselves.
- Found by running the suite inside a derived project, not inside this one. A template's tests
  passing in the template says nothing about them passing where the template is used.

## 2026-09-21 - Repository public, branch protection on, ADR 0003 follow-up closed

- `main` protected: pull request required, `Documentation state` and `ADR drift` required to pass,
  `enforce_admins` on, force pushes and deletions refused. Verified by reading the API back.
- Unblocked by making the repository public. Branch protection on a private repository needs a
  paid plan, so for a day the mitigation in
  [ADR 0003](decisions/0003-run-the-adr-gate-on-pull-requests-only.md) did not exist at all.
- Scanned the tree before publishing: no keys, tokens, absolute local paths or addresses in any
  file. Commit author emails are public now, and two commits carry a work address rather than the
  noreply one used elsewhere in the history. Local `user.email` set to the noreply address so it
  does not recur; the existing two are in published history and rewriting them needs a force push
  that protection now refuses.
- ADR 0003's negative section sharpened: a project from this template starts with the direct-push
  hole open until someone configures the remote, and `/harden` is the only place that says so.

## 2026-09-21 - `stage` had gone missing from the shipped config

- `.claude/gates.json` did not declare `stage` at all. Restored, and the linter now requires the
  key explicitly, plus rejects an empty `sourcePaths`/`manifests`/`guardrails`/`secretPaths`.
- Nothing noticed for a day: the code's `building` default covered for it, every check stayed
  green, [ADR 0004](decisions/0004-gates-are-staged.md) claiming the key exists stayed wrong, and
  the knob was undiscoverable. A default that hides its own absence is worse than no default.
- Cause: `git checkout -- .claude/gates.json` during debugging, to drop a temporary value, also
  dropped the still-uncommitted addition of the key. Second time a destructive git command in a
  debugging step ate uncommitted work.
- Branch protection on `main` turns out to be unavailable: GitHub requires Pro or a public
  repository. The mitigation named in [ADR 0003](decisions/0003-run-the-adr-gate-on-pull-requests-only.md)
  cannot be applied as written, and that ADR says to revisit rather than leave the hole implied.

## 2026-09-21 - Test setup and code CI deferred out of onboarding

- The day-one test asserted that a scaffolded health endpoint returns `200`, which tests the
  scaffold; the code CI job spent ~20s per push printing that it had nothing to do. Measured on
  this repository's own runs, not assumed.
- Phase 6 now proves the toolchain only. Testing is decided in the first spec's `plan.md`, where
  the feature's shape is known. Reasoning in [ADR 0005](decisions/0005-defer-code-scaffolding.md).
- Code CI ships as `.github/workflows/code.yml.example`, activated by renaming as a spec task.
- `/harden` now hard-requires a test command that fails when the code is wrong. That is where the
  deferral gets paid off, and ADR 0005 states plainly that this trades a guarantee for a convention.

## 2026-09-21 - Gates staged, template published, onboarding given a fast path

- Calibration was wrong for the purpose: gates built to keep a production project from decaying
  were fighting the week a new project is still finding its shape. Now staged, reasoning in
  [ADR 0004](decisions/0004-gates-are-staged.md).
- `/onboard` sets `exploration` on a new project; new `/harden` moves it to `building` with a
  checklist. The secret guard runs at every stage.
- Repository published as a GitHub template, so a new project is one `gh repo create --template`.
- `/onboard` phase 2 now sizes itself to the brief: a rich idea document leaves two questions
  instead of running the full list.

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

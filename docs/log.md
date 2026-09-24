# Change Log

Journal of operations, not a second place to store knowledge. One entry per meaningful change:
3 to 6 bullets, each answering "what changed and where", linking to the spec or ADR that holds
the actual content.

Newest entry on top.

## 2026-09-24 - NestJS and Nuxt pack on CleanSlice

- New pack and track `nestjs-nuxt`: CleanSlice structure, naming, patterns and its
  `cleanslice-check.cjs`, with the template's process and principles on top. See
  [ADR 0017](decisions/0017-nestjs-nuxt-pack-on-cleanslice.md).
- The pack adds the CleanSlice MCP server to a project's `.mcp.json` as reference. Their workflow
  rules, "MUST consult" rule and MCP-verifying Stop hook are not taken.
- Conflicts resolved in the pack, including CleanSlice pages that disagree with each other:
  controller calls only the service; grouped slices; `class-validator` with `transform` and
  `forbidNonWhitelisted` on the API, zod in the app; Nuxt auto-imports.
- Tracks can declare `requires`: `nextjs` and `nestjs-nuxt` require `typescript`, and the
  adapter and manifest lint refuse to drop it while they are kept. New regression test.
- Onboarding phase 4 weighs stacks that have a pack; phase 6 writes a pack's MCP server with
  only its read tools allowed. ADR 0017 accepted after a council review: precedence is an
  explicit list, `forbidNonWhitelisted` is per project by client type, MCP use is optional.

## 2026-09-24 - Documentation gate in CI, reasons instead of labels

- New `check:docs` in CI, a step of the required "ADR drift" job: a new source or infrastructure file needs a log entry,
  `docs.filesWithoutSpec` changed files a spec or ADR too, a small edit nothing. See
  [spec 0002](specs/0002-docs-gate-policy/spec.md) and [ADR 0016](decisions/0016-escape-reasons-live-in-the-pull-request.md).
- The Stop hook uses the same function, `docsGaps` in `scripts/docs-policy.mjs`.
- Escapes for both gates are `No-docs-reason:` / `No-ADR-reason:` lines of 20+ characters in the
  pull request description, passed as `PR_BODY`; CI re-runs on `edited`. The label no longer counts.
- Principle 4 now states the rule that is enforced. Moves and deletions do not count as new code;
  hidden (commented) reasons and word-less reasons are rejected.
- Review follow-ups: only exact renames (`R100`) are moves; legacy `stopHook.requireLogEntry` is
  honoured; `docs` keys are optional to lint; reasons in fenced code are ignored; CI runs of one
  pull request supersede each other.

## 2026-09-24 - Lifecycle follow-ups

- The ADR cleanup exception now reads onboarding status from the comparison base only. The
  canonical onboarding branch, which completes onboarding and cleans up in one diff, had been
  reported as forbidden deletion; resetting status in the working tree cannot reopen it either.
  Spec 0001 criterion 6 clarified to match.
- `npm run check` includes `test:regressions`, so the local check is the CI set bar `test:derived`;
  `/harden` names both.
- Marker `untracked-dirs-expanded` moved to the code that now does the work; the marker test uses
  its own fixture instead of a shipped marker.
- Test harnesses drop `SKIP_ADR_CHECK` and `BASE_REF`: a caller's skip had made every
  "fails without an ADR" gate test pass vacuously.

## 2026-09-24 - Make the template lifecycle verifiable

- Added complete track ownership, validated by doc lint, and a shared preview-first onboarding
  adapter; registered template specs and ADRs for cleanup. See [ADR 0015](decisions/0015-share-template-track-ownership.md).
- Gate tests use controlled scope profiles and placeholder inputs, and omit deleted working files.
- ADR checks retain Git statuses, reject record deletion separately and limit onboarding cleanup
  to exact base-manifest paths; moved the committed-change regression marker with the fix.
- Repair distinguishes missing runners, execution failures, timeout and signals from failed tests.
- Added disposable regression and derived-project checks to CI. Verification and limitations are
  recorded in [spec 0001 tasks](specs/0001-template-lifecycle/tasks.md).

## 2026-09-24 - Design track before frontend work

- `/design` (create, light, revise) makes the design system with the `frontend-design` plugin skill:
  `docs/design/system.md`, `design/tokens.css`, HTML prototypes approved in a browser. See [ADR 0014](decisions/0014-design-before-frontend.md).
- `design-system` skill filled: artifacts, three-layer tokens, the accessibility and states floor,
  how code uses tokens. New read-only `design-reviewer` agent, run by `/ship` on UI changes.
- Specs carry `ui: true`; the linter refuses to approve one until the design is `stable`.
- `/harden` checks security, design and infrastructure before flipping the stage, not after.

## 2026-09-24 - Engineering rulebook with stack packs

- New `engineering-rulebook` skill: stack-agnostic principles plus packs for TypeScript, Next.js,
  Python and Go, each rule marked as tool-enforced or reviewed. See [ADR 0013](decisions/0013-engineering-rulebook-with-stack-packs.md).
- Onboarding applies the pack: review rules into `.claude/rules/`, tool rules into strict type
  checking, lint, formatter and a boundary checker built from `overview.md`; unused packs deleted.
- `code-reviewer` checks the reviewed rules; `code.yml.example` runs the mechanical floor, with
  Python and Go variants; `/harden` requires it green.
- Lint warns when a placeholder rule or skill survives onboarding.

## 2026-09-24 - Security track

- Onboarding asks the security questions, writes `docs/security/threat-model.md`, records an ASVS
  level ADR and the project rules for the `security-guidance` plugin. See [ADR 0012](decisions/0012-security-designed-in.md).
- New `security-rulebook` skill, read-only `security-reviewer` agent, and `/security` audit command
  writing dated reports. `/ship` runs the reviewer and the built-in `/security-review`.
- Approved specs must carry a non-empty `## Security` section. `security-guidance` enabled as a
  project plugin.
- `ci.yml` gains a gitleaks history scan at every stage; `security.yml.example` (osv-scanner,
  semgrep) and `dependabot.yml.example` wait for code. `/harden` blocks on all of it.

## 2026-09-24 - Bounded repair loop

- `scripts/repair.mjs` and `/repair`: headless `claude -p` attempts under a dollar cap and a turn
  cap, allowed to edit only inside `sourcePaths` and run only the test command. See
  [ADR 0011](decisions/0011-bounded-repair-loop.md).
- The script, not the agent, judges: it hashes the test files, checks every changed path against
  the scope, runs the test itself, and refuses a dirty tree or an already passing test.
- Dry run by default; `--confirm` spends, and `npm run repair` is on the permission ask list.
- Eight gate tests against a fake `claude`, including the agent editing the test. Not yet run
  against the real CLI.

## 2026-09-24 - Regression guards for fixes, decisions, warnings and context

- `markers` in `.claude/gates.json`: lint fails, with the reason, when a string guarding a past fix
  disappears. Six seeded from this template's own fixes. See [ADR 0010](decisions/0010-guard-fixes-decisions-and-context-against-regression.md).
- Warning ratchet: `/harden` creates `.claude/lint-baseline.json`; warnings may fall, not rise, and
  `--update-baseline` only lowers it.
- ADR checks now catch supersede cycles; `code-reviewer` checks the diff against accepted ADRs.
- `session-start.mjs` restores branch, uncommitted files and tasks in flight after compaction.
- Principle 7: recording work is not doing it. Ideas taken from a review of ruflo; none of its code.

## 2026-09-24 - Infrastructure track, agent scopes, working patterns

- Optional infrastructure track: `infra-architect`, `infra-engineer`, `infra-reviewer`, skills
  `infra-bootstrap` and `infra-change`, the generic `infra-rulebook`, `/infra`, and an inactive
  `infra.yml.example`. Mapped onto specs, tasks and ADRs, see [ADR 0007](decisions/0007-optional-infrastructure-track.md).
  It scales: architect Mode 0 advises on hosting at onboarding, `/infra` can lay the foundation
  only, and small trees run light (`infra.lightBootstrapMaxComponents`).
- New `agent-scope.mjs` holds every writing or executing subagent to its files and commands, from
  `agentScopes` in `.claude/gates.json`; `pre-bash.mjs` refuses `apply`, `destroy`, `import` and
  state moves at every stage. Reasoning in [ADR 0008](decisions/0008-scope-agents-and-refuse-infrastructure-mutation.md).
- `infra.foundations` joins the ADR gate; infrastructure files count toward the Stop hook's spec
  and log nudges. State and plan files are ignored and treated as secret-bearing.
- `AGENTS.md` gains change tiers, failure classification, `[OVERRIDE]`/`[PROPOSED]` tags,
  "resolve, do not recall" and rule gaps; `/ship` runs a two-cycle review, see
  [ADR 0009](decisions/0009-working-patterns-in-the-constitution.md).
- Fixed in passing: `git status` collapsed a new untracked directory to its name, so file globs
  such as `**/backend.tf` never saw files inside it. Now `--untracked-files=all`.
- Not verified: no agent or skill in the track has run in a live session yet. The gate tests cover
  the hooks, not the prompts.

## 2026-09-22 - What a derived project inherits, decided rather than defaulted

- Measured on the first real use: six of fourteen decision records in the derived project were the
  template's own construction history, and two shipped documents warned on every lint run for the
  life of the project. Reasoning in [ADR 0006](decisions/0006-what-a-project-inherits.md).
- Leading underscore now marks a template stub, ignored by the linter until renamed into place.
  `_integrations.md` and `_runbook.md` join `_template.md`.
- A project inherits one decision record instead of six: `0000` plus `_inherited-tooling.md`, which
  summarises what the gates do rather than how they were built. Project records start at `0002`.
- The linter warns when `sourcePaths` matches nothing, closing the follow-up ADR 0002 named after
  the failure it created. One warning, not one per glob.
- `/harden` no longer carries an item that cannot pass: where branch protection is unavailable, the
  item is satisfied by recording the acceptance as an ADR.

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

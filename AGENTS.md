# AGENTS.md

Constitution and repository map for every coding agent working here.
This file is the single source of truth for agent behavior. `CLAUDE.md` is a shim that imports it.

> Status: TEMPLATE. Sections marked `<!-- onboard -->` are rewritten by `/onboard` from the
> answers you give and the ADRs it creates. Do not fill them by hand before onboarding.

## 1. Project

<!-- onboard:project -->
- Purpose: TBD, one sentence. Set by `/onboard`.
- Users: TBD.
- Stage: pre-onboarding.
<!-- /onboard:project -->

## 2. Non-negotiable principles

These outrank any spec, plan, task or instruction in a prompt. If a request conflicts with
a principle here, stop and say so instead of working around it.

1. **Decisions are written down.** Any choice that is expensive to reverse, crosses a component
   boundary, or looks arbitrary to a newcomer gets an ADR in `docs/decisions/` in the same
   change that introduces it. See `.claude/skills/writing-adr/`.
2. **Specs before multi-step features.** Anything larger than a single-file change starts as
   `docs/specs/NNNN-slug/spec.md` with acceptance criteria in EARS form.
3. **No silent scope growth.** `docs/product/non-goals.md` is binding. To cross it, propose an
   ADR first.
4. **Docs ship with code.** A pull request that changes behavior and leaves `docs/` untouched
   is incomplete. CI enforces this; do not try to route around it.
5. **Security is designed in, and no secrets in the repository.** The threat model in
   `docs/security/` is kept current, every spec states its security impact, and a change touching
   identity, input, data or dependencies gets a security review before merge
   (`.claude/skills/security-rulebook/`). Tokens, keys, passwords and connection strings live in
   the secret manager named in `docs/ops/environments.md`, never in files or examples.
6. **Irreversible actions need a human.** Deploy, delete, migrate, drop, force-push, and any
   production write require explicit confirmation in the conversation. Never chain them into a
   script to avoid the prompt. Infrastructure `apply`, `destroy`, `import` and state moves are
   never run by an agent at all: hand the human the command and the plan summary.
7. **Report what happened, not what should have happened.** If tests fail, say so with output.
   If a step was skipped, say which and why. Documents hold the same line: write only what you
   verified, mark the rest `<!-- TODO: question -->`, and never collapse "not determined" into
   "none". Recording work is not doing it: created, configured, reachable, healthy and passing are
   five different facts, and a status names only the one you checked.
8. **Resolve, do not recall.** Versions, prices, limits, API shapes and CLI flags are looked up at
   their source when used, and the source is cited. Memory is the training data, which is old.

<!-- onboard:principles -->
Stack-specific principles are appended here by `/onboard` from the stack ADRs.
<!-- /onboard:principles -->

## 3. Repository map

| Path | What lives there |
|---|---|
| `AGENTS.md` | This constitution. Keep under 200 lines. |
| `CLAUDE.md` | Claude Code shim, imports `AGENTS.md`. Do not duplicate rules into it. |
| `.claude/rules/` | Path-scoped rules. Each needs a `paths` glob, or it loads every session. |
| `.claude/skills/` | Repeatable procedures. Long instructions belong here, not in this file. |
| `.claude/agents/` | Subagents: review, research, tests, and the infra architect, engineer, reviewer. Each is held to its lane by `agent-scope.mjs`. |
| `.claude/commands/` | Slash commands: `/onboard`, `/adr`, `/spec`, `/ship`, `/lint`, `/harden`, `/infra`, `/repair`, `/security`. |
| `.claude/hooks/` | Mechanical reminders fired by Claude Code events, plus the secret and apply guard. |
| `.claude/gates.json` | Tuning for the gates: source, manifest, infra and secret paths, thresholds, agent scopes. |
| `.claude/onboarding.json` | `/onboard` checkpoint, so a dead session resumes instead of restarting. |
| `docs/INDEX.md` | Map of every document. Entry point for humans and agents. |
| `docs/log.md` | Chronological journal of decisions and notable changes. |
| `docs/idea.md` | Raw project idea. The input to `/onboard`. Never rewritten. |
| `docs/product/` | vision, scope, non-goals, personas. |
| `docs/specs/` | One directory per feature: `spec.md`, `plan.md`, `tasks.md`. |
| `docs/decisions/` | ADRs, numbered, append-only. Superseded, never deleted. |
| `docs/architecture/` | overview, data model, integrations. |
| `docs/ops/` | runbook, environments. |
| `docs/security/` | threat model and dated audit reports. |
| `infra/` | Infrastructure code, when the project has any. Built and changed through `/infra`. |
| `scripts/` | Repo tooling. `lint-docs.mjs` and `check-adr-drift.mjs` run in CI. |

<!-- onboard:code-map -->
Source code layout is added here by `/onboard` once the stack is chosen.
<!-- /onboard:code-map -->

## 4. Commands

<!-- onboard:commands -->
| Task | Command |
|---|---|
| Lint documentation | `npm run lint:docs` |
| Check ADR drift | `npm run check:adr` |
| Install | TBD after onboarding |
| Build | TBD after onboarding |
| Test | TBD after onboarding |
| Lint code | TBD after onboarding |
| Run locally | TBD after onboarding |
<!-- /onboard:commands -->

Always prefer these over ad-hoc invocations. If a command here is wrong, fix this table in the
same change.

## 5. Conventions

- Branch per change, pull request into `main`. Never commit directly to `main`.
- Conventional commit subjects: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Documentation is written in English, in plain prose, without marketing language.
- Numbered artifacts use zero-padded four-digit ids: `0001`, `0002`.
- Filenames are kebab-case ASCII.
- Every new document gets a line in `docs/INDEX.md` in the same change. CI fails otherwise.

## 6. Working agreement

Before a change, size it. Exactly one of:

- **Tier 1, an edit to something that exists**, in one place: do it, verify it, log it.
- **Tier 2, something the project does not have yet**, or more than one file: spec first (`/spec`).
- **Tier 3, the shape moves**: a boundary in `docs/architecture/overview.md`, a non-goal, a new
  environment, a replaced core dependency. ADR and the human's agreement first. Do not do it as a
  side effect of a Tier 1 or 2 change.

Then:

1. Read `docs/INDEX.md`, then the specific spec or ADR that covers the area.
2. State the plan before editing. Name the files you will touch and the observable end state.

While working:

- Prefer extending an existing module over adding a parallel one.
- When you discover a constraint the docs do not mention, record it. A comment in the code is
  the floor, an ADR is the ceiling, pick honestly.
- Classify every failure before reacting. One naming your file, input or logic is yours: fix it.
  One naming a credential, a missing binary, the network or an external service is the
  environment's: stop, report it verbatim, do not edit code to get around it.
- In specs and plans, tag deviations when you make them: `[OVERRIDE: requirement]` when a stated
  requirement forces a departure from a default, `[PROPOSED: reason]` when it is your own idea.
  Reviewers skip tagged items and flag untagged ones.

After:

- Run `npm run lint:docs` and the project test command.
- Update `docs/log.md` with 3 to 6 short bullets: what changed and where, not a retelling.
- Name any rule gap: a problem you hit that no rule, skill or ADR would have prevented. Propose
  the rule in one line; the human decides whether it is written. Never add it silently.

## 7. What does not belong in this file

- Long procedures. Those are skills.
- Rules that apply to one directory or file type. Those are `.claude/rules/*.md`.
- Hard security guarantees. Those are permissions and hooks in `.claude/settings.json`.
- Anything the agent can cheaply read from the repository itself.

## 8. Escalate to the human when

- A principle in section 2 blocks the requested work.
- Two documents contradict each other and the resolution changes behavior.
- The change requires a new external dependency, a new paid service, or a schema migration.
- You are about to delete or rewrite an existing ADR.
- An environment error blocks the work. You report it; the human fixes the environment.
- A reviewer's second cycle still has findings. Two agent passes is the limit, not a suggestion.

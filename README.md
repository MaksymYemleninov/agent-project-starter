# agent-project-starter

A repository skeleton for building a project *with* coding agents rather than around them.

You drop your raw idea into `docs/idea.md`, run `/onboard`, and the agent interrogates the idea,
records the stack choices as ADRs, generates the constitution from those decisions, scaffolds the
code and CI, and cuts the first spec. From then on every change carries its documentation, and CI
refuses the pull request if it does not.

## Quick start

This repository is a GitHub template, so a new project is one command:

```bash
gh repo create my-project --template MaksymYemleninov/agent-project-starter --private --clone
```

Then:

1. Put everything you already have about the idea into `docs/idea.md`. A written brief, notes,
   half a business plan, a paragraph. Do not polish it.
2. Open the project in Claude Code, or any agent that reads `AGENTS.md`.
3. Run `/assess` if the idea is not yet committed to, `/onboard` if it is.
4. Answer what it asks. A rich brief leaves two questions; a paragraph leaves most of them.
5. Review the decisions it proposes before it writes code.

What you get back is a foundation, not a product: product documents, the stack recorded as
decisions, a constitution generated from those decisions, a running skeleton with tests and CI,
and the first spec. Development starts from there.

## Gates are advisory until you say otherwise

A new project starts at `stage: exploration` in `.claude/gates.json`. The gates run, report what
they find, and block nothing. This is deliberate: a project whose shape changes weekly should not
have pull requests blocked over a missing decision record about code that may not exist next week.

When the project stops being an experiment, run `/harden`. The gates then hold: a pull request that
moves architecture, dependencies or the guardrails themselves without recording why will fail.

The one check that runs at every stage is the secret guard, because a leaked credential is not a
process question.

## What is in here

| Layer | Where | Purpose |
|---|---|---|
| Constitution | `AGENTS.md` | Principles no spec or prompt may override |
| Path rules | `.claude/rules/` | Rules that load only for matching files |
| Procedures | `.claude/skills/` | Repeatable how-to knowledge, loaded on demand |
| Delegation | `.claude/agents/` | Reviewer, researcher, test-writer subagents |
| Entry points | `.claude/commands/` | `/onboard` `/adr` `/spec` `/ship` `/lint` |
| Enforcement | `.claude/settings.json`, `.github/workflows/ci.yml` | Permissions, hooks, CI gates |
| Product | `docs/product/` | vision, scope, non-goals, personas |
| Specs | `docs/specs/` | One directory per feature, EARS acceptance criteria |
| Decisions | `docs/decisions/` | ADRs, append-only, superseded never deleted |
| Architecture | `docs/architecture/` | overview, data model, integrations |
| Operations | `docs/ops/` | runbook, environments |

## The idea behind the gates

Prose reminders in an instruction file do not survive a long session. An agent reads
"remember to write an ADR", works for two hours, and ships without one. So the rules that matter
are not prose:

- a `Stop` hook checks for missing documentation before the session ends,
- `npm run lint:docs` validates structure, frontmatter, links, orphans and staleness,
- `npm run check:adr` fails a pull request that changes `docs/architecture/` or dependencies
  without adding a decision record,
- `npm run test:gates` tests the gates themselves against a disposable copy of the repository,
  because every bug found in them so far would otherwise have come back on the next edit.

Reminders are cheap and unreliable. Hooks catch forgetfulness. CI is the only thing that actually
holds. All three are wired up here.

## Path-scoped rules

`.claude/rules/*.md` is what keeps the constitution under 200 lines. A rule that applies to one
directory or one file type goes here instead of `AGENTS.md`, with a `paths` glob in its
frontmatter:

```markdown
---
description: one line, what this covers
paths:
  - "src/api/**/*.ts"
---

- All API endpoints validate input at the boundary.
```

Rules with `paths` load only when Claude touches a matching file. A rule **without** `paths` loads
into every session and costs context every time, so `npm run lint:docs` warns about it. That is a
mistake worth catching: it is invisible at runtime and it compounds.

`/onboard` replaces the placeholder rules with real ones for the chosen stack and deletes the rest.

## Commands

| Command | What it does |
|---|---|
| `/onboard` | Idea to scaffolded project: questions, ADRs, constitution, skeleton, first spec |
| `/assess` | Go / needs-clarification / kill on an idea, without building anything |
| `/spec` | New feature spec with EARS acceptance criteria, plan and tasks |
| `/adr` | Record one architecture decision |
| `/ship` | Pre-pull-request gate: tests, doc lint, ADR drift, log entry |
| `/lint` | Run the documentation linters and summarize |

## Known limits

Worth stating plainly, because a guardrail you trust more than it deserves is worse than none.

- **The permission layer is not a security boundary.** `permissions.deny` on `Read(./.env)` only
  stops the Read tool, so a `PreToolUse` hook closes the shell path that walked around it. That
  hook is still string matching against paths: it stops accidents, not a determined attempt. Real
  containment is the sandbox, the secret manager, and not putting production credentials on the
  machine.
- **Hooks are reminders with teeth, not enforcement.** The Stop hook blocks once per session and
  then stands aside by design, because a hook that can block forever is a hook someone deletes.
  CI is the only gate that actually holds.
- **The ADR gate checks substance, not judgement.** It enforces a minimum: a real Context section,
  at least two options, a non-empty negative consequence, no leftover template placeholders. It
  cannot tell whether the reasoning is any good, and a determined author can pad past every
  threshold. That part is still review.
- **`/onboard` resumes, but does not replay.** `.claude/onboarding.json` records the phase reached
  and anything agreed but not yet written, so a session that dies mid-onboarding continues instead
  of starting over. It does not capture the conversation, so a resumed session may re-ask a
  question whose answer was never written down.
- **The gate defaults assume a JavaScript layout.** `sourcePaths` in `.claude/gates.json` lists
  `src/`, `app/`, `lib/` and friends. For a Python or Go project those match nothing and the Stop
  hook quietly stops noticing source changes, so `/onboard` rewrites them in phase 5. If you skip
  onboarding, edit that file first.

## Tuning

`.claude/gates.json` holds everything the gates argue about: which paths count as source, which
files are dependency manifests, which are guardrails, how many source files may change before a
spec is expected, and which paths are treated as secret-bearing. Changing it is itself a guardrail
change, so the ADR gate asks for a record.

## Scope of this template

Deliberately stack-agnostic. There is no framework, no bundler and no opinion about your database
in here, because `/onboard` picks those with you and records why. The only runtime dependency is
Node 20+ for the two lint scripts, and they have no npm dependencies.

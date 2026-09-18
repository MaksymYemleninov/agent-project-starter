# agent-project-starter

A repository skeleton for building a project *with* coding agents rather than around them.

You drop your raw idea into `docs/idea.md`, run `/onboard`, and the agent interrogates the idea,
records the stack choices as ADRs, generates the constitution from those decisions, scaffolds the
code and CI, and cuts the first spec. From then on every change carries its documentation, and CI
refuses the pull request if it does not.

## Quick start

```bash
git clone <this repo> my-project && cd my-project
rm -rf .git && git init
npm install   # nothing to install yet, creates the lockfile once you add a stack
```

1. Write your idea into `docs/idea.md`. Prose is fine, bullet points are fine, half-formed is fine.
2. Open the project in Claude Code (or any agent that reads `AGENTS.md`).
3. Run `/onboard`.
4. Answer the questions it asks. This is the step that pays for itself.
5. Review the ADRs it proposes before it writes code.

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
  without adding a decision record.

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

## Scope of this template

Deliberately stack-agnostic. There is no framework, no bundler and no opinion about your database
in here, because `/onboard` picks those with you and records why. The only runtime dependency is
Node 20+ for the two lint scripts, and they have no npm dependencies.

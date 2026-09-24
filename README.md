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
decisions, a constitution generated from those decisions, a skeleton that runs, and the first spec.
Development starts from there.

Test setup and code CI are deliberately **not** part of that foundation. They arrive with the first
feature that needs them, when the shape of the thing is known rather than guessed. `/harden` is the
checkpoint that requires them.

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
| Delegation | `.claude/agents/` | Reviewer, researcher, test-writer, and the three infra agents, each scoped by hook |
| Entry points | `.claude/commands/` | `/onboard` `/assess` `/adr` `/spec` `/ship` `/lint` `/harden` `/infra` |
| Enforcement | `.claude/settings.json`, `.github/workflows/ci.yml` | Permissions, hooks, CI gates |
| Product | `docs/product/` | vision, scope, non-goals, personas |
| Specs | `docs/specs/` | One directory per feature, EARS acceptance criteria |
| Decisions | `docs/decisions/` | ADRs, append-only, superseded never deleted |
| Architecture | `docs/architecture/` | overview, data model, integrations |
| Operations | `docs/ops/` | runbook, environments |
| Infrastructure | `infra/`, `.claude/skills/infra-*` | Optional. IaC built through `/infra`, deleted at onboarding if unused |

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

## Infrastructure, when the project owns some

Whether a project needs this is decided at onboarding with `infra-architect` advising: managed
platform or own account, a rough topology and bill, and which foundation choices to record now even
if nothing is built yet. A project on a managed platform deletes the track. One that keeps it uses
`/infra` for everything under `infra/`, and can either build now or only lay the foundation (spec,
plan, accepted ADRs) and build later from it. Small trees (up to five components, two environments)
run a light pipeline; larger ones the full one:

- **`infra-bootstrap`** turns requirements into an infrastructure spec, has `infra-architect` write
  the plan with every version resolved from its source and the foundation choices proposed as
  ADRs, runs `infra-reviewer` on it (two cycles at most), waits for the human's approval, has
  `infra-engineer` build it in dependency-ordered batches with a `plan` after every component, then
  reviews the code the same way.
- **`infra-change`** sizes a change first. A version bump goes to the engineer alone; a new
  component gets a spec, a change analysis and approval; a new environment or a moved foundation is
  sent back to an ADR and a bootstrap, not handled on the side.
- **`infra-rulebook`** is the standard all three agents plan, write and review against: Terraform
  or OpenTofu, optionally Terragrunt, remote state, one state per environment, versions resolved
  and pinned, tags for anything that deviates. It ships generic with a worked AWS baseline;
  replace the naming section and link your ADRs once they exist.

It uses the template's own documents: the plan is the spec's `plan.md`, the engineer's journal
and resume point is its `tasks.md`, review cycles go into a `review.md` beside them. There is no
second decision system.

**Agents never apply.** `apply`, `destroy`, `import`, `refresh`, taint and state moves are refused
for every agent at every stage by the `pre-bash` hook, the same way secret reads are, including
behind `cd ... &&` or `mise exec --`. The engineer ends with a punch list for the human: what to
fill in, what to apply in which order, and every destroy or replace any plan showed.

## Agents stay in their lane

`tools:` says which tools an agent may call, not what it may do with them. Every agent that can
write or run commands carries a hook in its frontmatter that checks each call against its profile
in `agentScopes` in `.claude/gates.json`: which paths it may write, which commands it may run. The
reviewers cannot edit what they review; the architect writes plans and proposed ADRs, not code.
A missing profile refuses everything, and the linter fails if an agent names one that does not
exist.

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
| `/harden` | Move the project from exploration to building: gates start blocking |
| `/infra` | Infrastructure: bootstrap it if there is none, otherwise size and run the change |

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
- **Agent scopes and the apply guard are a tokenizer, not a shell.** They read through quotes,
  subshells, `env`, `timeout`, `aws-vault` and `sh -c`, but a command built to evade them (an
  alias, a script file) will. Frontmatter hooks are a Claude Code feature; another runtime reading
  these agents gets the prompts without the enforcement.
- **The infra track is unproven end to end.** The hooks are tested; the agents and skills are
  prompts that have not yet run a real bootstrap. Treat the first one as the test.
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

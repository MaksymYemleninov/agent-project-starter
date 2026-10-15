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

During onboarding this README is replaced by one written for your project, so a project keeps its
own front page. What this file explains about the gates stays available, as a skill.

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

## What it gives a project

- **Design before frontend.** Projects with a UI make their design system and approved HTML prototypes first, and a spec with `ui: true` cannot be approved until they exist. See the [design-system skill](.claude/skills/design-system/SKILL.md).
- **Code to a standard, enforced by tools.** A short set of principles and one pack per stack (TypeScript, Next.js, Python, Go, NestJS + Nuxt), turned into linter, type-checker and boundary-checker configuration at onboarding. See the [engineering rulebook](.claude/skills/engineering-rulebook/SKILL.md).
- **Security from the first question.** A threat model, an ASVS level, a `## Security` section in every spec, a read-only security reviewer and secret scanning in CI. See the [security rulebook](.claude/skills/security-rulebook/SKILL.md).
- **Infrastructure, when the project owns some.** An architect, an engineer and a reviewer that plan and write Terraform or OpenTofu, and never apply it. See the [infra rulebook](.claude/skills/infra-rulebook/SKILL.md).

## Operating the gates

How the documentation gates, hooks, track ownership, agent scopes and the repair loop work, and
what they do not cover, is in the [gates-and-tracks skill](.claude/skills/gates-and-tracks/SKILL.md).
Gates only report until you run `/harden`. Read its [known limits](.claude/skills/gates-and-tracks/limits.md)
before trusting a guardrail.

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
| `/repair` | Make one failing test pass in a budget-capped headless loop that cannot touch the test |
| `/security` | Whole-project security audit: threat model against the code, scanners, reviewer, dated report |
| `/design` | Design system before frontend work: direction, tokens, HTML prototypes approved in a browser |

## Scope of this template

Deliberately stack-agnostic. There is no framework, no bundler and no opinion about your database
in here, because `/onboard` picks those with you and records why. The only runtime dependency is
Node 20+ for the two lint scripts, and they have no npm dependencies.

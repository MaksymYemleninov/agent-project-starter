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
- `npm run check:docs` fails a pull request whose code arrives without its documentation, in
  proportion: a new file needs a `docs/log.md` entry, a change across `docs.filesWithoutSpec`
  files a spec or ADR too, a small edit nothing. The Stop hook applies the same rule locally,
- escapes are a `No-docs-reason:` or `No-ADR-reason:` line in the pull request description, of at
  least 20 characters, re-checked when the description is edited. A label is not a reason,
- `npm run test:gates` tests the gate mechanisms with controlled profiles in a disposable copy of the repository,
  because every bug found in them so far would otherwise have come back on the next edit.

Reminders are cheap and unreliable. Hooks catch forgetfulness. CI is the only thing that actually
holds. All three are wired up here.

## Design before frontend

Projects with a UI make their design before building it. `/design` uses Anthropic's
[`frontend-design`](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design)
skill (enabled as a project plugin) for the aesthetic direction, and the template's
`design-system` skill for the contract:

- `docs/design/system.md`: brief, direction, principles, token rationale with contrast ratios,
  component inventory, decisions;
- `design/tokens.css`: primitive, semantic and component tokens, light and dark;
- `design/prototypes/*.html`: two or three key screens with real content and every state, reviewed
  in a browser at mobile and desktop width, approved by the human.

A spec with `ui: true` cannot be approved until the design system is. Components use semantic
tokens only; `design-reviewer` checks tokens, states, the accessibility floor and fidelity to the
prototype in `/ship`. Projects without a UI delete the track at onboarding.

## Code to a standard, enforced by tools

`.claude/skills/engineering-rulebook/` holds the standard: a short set of principles (simple first,
structure by feature, dependencies pointing inward, parse at the edge, errors handled once,
configuration validated at startup) and one pack per stack, for TypeScript, Next.js, Python, Go, and NestJS + Nuxt on the
[CleanSlice](https://cleanslice.org) architecture, with its MCP server as optional reference docs.
Each rule says whether a tool enforces it or review checks it.

Onboarding applies the pack. Tool rules become configuration: the strictest type checking, a
linter with complexity limits, a formatter, and a boundary checker (dependency-cruiser,
import-linter, or Go's `internal/` plus depguard) that carries the boundaries from
`docs/architecture/overview.md`, so crossing one fails the build. Review rules go into
`.claude/rules/`, and `code-reviewer` checks them. Unused packs are deleted.

## Security from the first question

Security starts at onboarding rather than at the first review:

- **Onboarding** asks what data is sensitive, who the users and roles are, what reaches the system
  from outside and which rules apply; writes `docs/security/threat-model.md` (assets, entry points,
  threats, controls, abuse cases); records an OWASP ASVS level (L1, L2, L3) as an ADR; and writes
  the project's rules for the security plugin into `.claude/claude-security-guidance.md`.
- **Every approved spec** has a `## Security` section, and its abuse cases are `If ...` criteria, so
  the controls are tested like any behaviour. The linter rejects an empty one.
- **Every change** that touches identity, input, data or dependencies gets `security-reviewer` (a
  read-only agent working from the threat model and the ASVS level) and the built-in
  `/security-review`, in `/ship`.
- **Every edit and turn** is watched by Anthropic's
  [`security-guidance`](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/security-guidance)
  plugin, enabled for the project in `.claude/settings.json`: pattern warnings, an LLM diff review,
  an agentic review at commit. It sends diffs to the model and costs tokens per turn; its
  environment variables turn layers off.
- **CI** scans the whole history for secrets from the first push. `security.yml.example`
  (osv-scanner, semgrep) and `dependabot.yml.example` activate with the code.
- **`/security`** audits the whole project into a dated report; `/harden` will not flip the gates
  with an open HIGH, a stale threat model or the security workflow off.

The standard behind all of it is `.claude/skills/security-rulebook/`.

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

## Things that must not quietly come back

Most gates check that something is written down. Four check that it stays right:

- **Markers.** `markers` in `.claude/gates.json` lists past fixes as a file and a string that must
  stay in it, with the reason. An agent that "simplifies" the fix away fails lint with that reason.
  Add one whenever you fix a bug that looks like needless complexity.
- **Warning ratchet.** `/harden` records the warning count in `.claude/lint-baseline.json`. From then
  on it may fall and not rise; `npm run lint:docs -- --update-baseline` lowers it after a cleanup
  and never raises it.
- **ADR compliance.** `code-reviewer` checks the diff against accepted decisions, not only for new
  ones missing, and the linter rejects supersede chains that loop.
- **Compaction.** After a context compaction the start hook puts the branch, the uncommitted files
  and the tasks marked `doing` back in front of the agent.

## Repairing a failing test

`/repair` (or `npm run repair -- --test "<command>" --test-file <path>`) runs headless `claude -p`
attempts with the limits enforced by the script rather than asked of the agent: a total dollar
budget, a turn cap, edits only inside `sourcePaths`, Bash only for the test command. After every
attempt the script checks the test files' hashes and every changed path, and runs the test itself;
the test's exit code is the only judge. It refuses a dirty tree and a test that already passes, and
without `--confirm` it only prints the plan.

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
| `/repair` | Make one failing test pass in a budget-capped headless loop that cannot touch the test |
| `/security` | Whole-project security audit: threat model against the code, scanners, reviewer, dated report |
| `/design` | Design system before frontend work: direction, tokens, HTML prototypes approved in a browser |

## Known limits

Worth stating plainly, because a guardrail you trust more than it deserves is worse than none.

- **The permission layer is not a security boundary.** `permissions.deny` on `Read(./.env)` only
  stops the Read tool and the file commands Claude Code recognises. `grep -r KEY .` names no file,
  and `grep` and `find` are built-in read-only commands that run without a prompt whatever the
  allow list says. So the project enables Claude Code's sandbox (`sandbox` in
  `.claude/settings.json`): shell commands cannot read the project's secret files or
  `~/.aws`, `~/.config/gcloud`, `~/.azure` and `~/.kube`, at the operating-system level.
  `autoAllowBashIfSandboxed` is off, so the sandbox adds that boundary without removing a single
  permission prompt. The `PreToolUse` hook stays as the readable second line, and it parses
  commands so that prose and loaders (`--env-file .env`) do not trip it. On Linux and WSL2 the
  sandbox needs `bubblewrap` and `socat`; without them Claude Code warns and runs unsandboxed.
  Run `/sandbox` in the first session to see that it is active. `~/.ssh` is left readable so
  `git push` over SSH works. Still: no production credentials on the machine.
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
- **`/repair` treats the test as the specification.** A wrong or flaky test gets code bent to fit
  it. It has been tested against a fake `claude`, not yet against the real CLI.
- **The infra track is unproven end to end.** The hooks are tested; the agents and skills are
  prompts that have not yet run a real bootstrap. Treat the first one as the test.
- **The gate defaults assume a JavaScript layout.** `sourcePaths` in `.claude/gates.json` lists
  `src/`, `app/`, `lib/` and friends. For a Python or Go project those match nothing and the Stop
  hook quietly stops noticing source changes, so `/onboard` rewrites them in phase 5. If you skip
  onboarding, edit that file first.

## Template ownership and lifecycle checks

`.claude/tracks.json` assigns every agent, skill file, command, rule, scope profile, plugin and
workflow to `core` or one optional track. `lint:docs` checks completeness, duplicates, enabled
items that are missing and disabled items that remain. Activating a `.yml.example` workflow keeps
its ownership. Register new project tooling in the manifest in the same change.

Onboarding and `npm run test:derived` use `scripts/adapt-template.mjs`. Its default is a preview;
`--confirm` applies the reviewed local cleanup. `--disable infra,design` removes owned items;
`--reset-records` removes exactly the registered template ADRs and specs, installs the inherited
record and resets the template log. It refuses completed onboarding, invalid paths and symlinks.

`npm run test:derived` creates a disposable project, disables optional tracks, replaces fixture
placeholders and runs `npm run check` at exploration and building, including a warning baseline.
It verifies the mechanical portion of hardening, not deployments, scanners or human approvals.
`npm run test:regressions` exercises the defects fixed during the template lifecycle review.
Neither command spawns a paid agent. CI runs both separately from `check` to avoid recursion.

Deleted ADRs never count as coverage. Deleting a project ADR is a separate violation even with
another ADR or an escape reason. Only exact template ADR paths registered in the comparison-base
manifest can be cleaned up before onboarding completes. Exploration reports violations without
blocking; building blocks them. Supersede project records rather than deleting them.

`repair` exits 3 for a missing/non-executable test runner, command-not-found output, timeout or
signal termination, before generating a repair plan or starting an agent.

## Tuning

`.claude/gates.json` holds everything the gates argue about: which paths count as source, which
files are dependency manifests, which are guardrails, how many source files may change before a
spec is expected, and which paths are treated as secret-bearing. Changing it is itself a guardrail
change, so the ADR gate asks for a record.

## Scope of this template

Deliberately stack-agnostic. There is no framework, no bundler and no opinion about your database
in here, because `/onboard` picks those with you and records why. The only runtime dependency is
Node 20+ for the two lint scripts, and they have no npm dependencies.

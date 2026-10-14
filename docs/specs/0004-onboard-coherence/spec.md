---
type: spec
id: "0004"
status: done
date: 2026-10-14
owner: maintainers
adrs: []
ui: false
design: null
---
# 0004 - Onboarding that matches the environment and the template's own rules

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

A first full onboarding of a derived project showed that `/onboard` and the documents around it
disagree with each other and with the machine they run on:

1. The environment is checked too late. A stopped container daemon surfaced in phase 6 and a
   macOS quirk (uv marks `.pth` files `hidden`, and Python 3.14 skips such files) after the stack
   was chosen. Both were knowable before phase 4.
2. Principle 8 (resolve versions at their source) meets the sandbox's network allowlist: PyPI was
   reachable, `hub.docker.com` and `endoflife.date` were not. The image tags stayed unverified, and
   nothing in `/onboard` says what to do then.
3. Phase 4 sends hosting to `infra-architect` "unless the project plainly runs nothing
   server-side". A local container is formally server-side, so the criterion does not say what it
   should: whether the project owns infrastructure beyond the user's machine.
4. Phase 5 edits `.claude/skills/*`, `.claude/commands/*` and `settings.json`, which the sandbox
   protects. The command does not say so, and the agent worked around it partly through Edit and
   once without the sandbox.
5. `writing-spec` says `plan.md` is written after `spec.md` is approved; phase 7 cuts spec, plan
   and tasks in one pass and leaves the spec in draft.
6. `lint-docs` warns about every `TODO` and advises removing it, while the documentation rules and
   principle 7 require `<!-- TODO: question -->` in place of a plausible sentence.
7. `docs/architecture/data-model.md` is reported as "still a template" although an ADR defers it
   to the first spec. There is no status for "decided later, on purpose".

## Goal

`/onboard` learns what the machine can do before it chooses a stack, says what it could not verify,
and follows the same rules as the skills it relies on; the linter tells an honest open question
from a forgotten marker, and a deliberately deferred document from an unfilled template.

## Non-goals

- Replacing the template's `README.md` with a project README, and conditional sections inside
  documents tied to a track (`<!-- track:... -->`). Both change a contract and get their own ADRs
  and specs.
- Changing the size of `AGENTS.md`, or the Python pack (spec 0006).
- Changing the sandbox's network allowlist. Reporting an unreachable host is in scope; opening it
  is the human's.
- Probing anything that needs credentials, or sending project data to a host.

## Users and triggers

A human or agent running `/onboard` on a new project; anyone running `npm run lint:docs` on a
project with open questions or deferred documents.

## Acceptance criteria

Linter (`scripts/lint-docs.mjs`):

1. When a document's only `TODO`, `FIXME` or `XXX` words sit inside `<!-- TODO: ... -->`
   comments, the linter shall not warn about them.
2. If a document contains `TODO`, `FIXME` or `XXX` outside such a comment, then the linter shall
   warn as it does today.
3. Where a document outside `docs/decisions/` and `docs/specs/` has `status: deferred`, the linter
   shall accept it, shall not report it as a template, and shall require an `adr` frontmatter value.
4. If a `deferred` document's `adr` is missing, or names a file that does not exist under
   `docs/decisions/`, then the linter shall fail with an error naming the document.

`/onboard` (`.claude/commands/onboard.md`), checked in review, since the command is prose:

5. The command shall have a step at the start of phase 4, before the stack table, that checks the
   tools and services the candidate stacks need (installed, running, reachable) by running
   read-only commands, and records each result as `ok`, `missing`, `unreachable` or `not checked`
   in `.claude/onboarding.json` under `environment`.
6. If a source needed to resolve a version is `unreachable`, then the command shall have the agent
   write `<!-- TODO: verify <value> at <source> -->` where the value would go, name the host the
   human would have to allow, and not present the value as verified.
7. The command shall decide whether `infra-architect` is consulted by whether the project owns
   infrastructure outside the user's own machine, and Mode 0's description in
   `.claude/agents/infra-architect.md` shall use the same wording.
8. Phase 5 shall tell the agent that `.claude/skills/*`, `.claude/commands/*` and
   `.claude/settings.json` are edited with Edit or Write after the human approves, to list the
   files it intends to change before the first edit, and to report a refused write instead of
   working around it.
9. When phase 5 records a decision that persistence is absent or deferred, the command shall have
   the agent set `docs/architecture/data-model.md` to `status: deferred` with `adr` naming that
   decision.
10. When phase 7 cuts the first spec, the command shall have the agent write `plan.md` and
    `tasks.md` with `status: draft`, and `writing-spec` shall say that this is the one allowed
    exception to "spec approved before plan", ending when the human approves the spec.

## Security

No new entry point, role or stored data. The preflight in criterion 5 runs read-only commands
(`command -v`, version flags, a daemon status call) and, for reachability, requests to public
registries that carry no credentials and none of the project's content; it goes through the
sandbox's normal network filter and does not change it. Criterion 6 stops the agent from writing an
unverified version as fact, which is a supply-chain hygiene gain (principle 8). Criterion 8 keeps
edits to the agent's own configuration behind the human's approval, as
[agent-config.md](../../../.claude/rules/agent-config.md) already says.

## Out of band

none

## Open questions

- [x] Which hosts does the preflight probe? Decided by the maintainer: a fixed short list in
  `/onboard`, derived from the candidates in phase 4 (the candidate stack's package registry, the
  container registry when Docker is a candidate, `endoflife.date`). No new data in the packs.
- [x] Where does the preflight result live? Decided by the maintainer: `environment` in
  `.claude/onboarding.json`, so a resumed onboarding does not re-probe, plus one line in the stack
  ADR for unverified items.

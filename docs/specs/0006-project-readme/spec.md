---
type: spec
id: "0006"
status: done
date: 2026-10-15
owner: maintainers
adrs: ["0020"]
ui: false
design: null
---
# 0006 - A README that belongs to the project

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

[ADR 0020](../../decisions/0020-write-the-project-readme-instead-of-inheriting-the-templates.md)
decided that a derived project's `README.md` is written, not inherited. Today it is inherited: 320
lines about the template, left in place by `/onboard`, with the mentions of any disabled track in
it. Nothing in `/onboard` replaces it, nothing in the linter notices that it still describes the
template, and the root `README.md` is not link-checked at all, so reorganising it is unprotected.

Part of that README is operating knowledge a project still needs, so it cannot simply be deleted.
Where each section goes:

| README section (current) | Goes to |
|---|---|
| Intro and Quick start | stays in the template README only |
| What is in here (layer table) | stays in the template README; the project's map is `AGENTS.md` section 3 |
| Design before frontend; Code to a standard; Security from the first question; Infrastructure | template README keeps two or three sentences and a link each; the detail is already in their skills (`design-system`, `engineering-rulebook`, `security-rulebook`, `infra-*`) |
| Commands | stays in the template README; the project README lists only its own commands |
| Scope of this template | stays in the template README only |
| Gates are advisory until you say otherwise; The idea behind the gates; Things that must not quietly come back; Agents stay in their lane | the new skill, moved without rewriting |
| Repairing a failing test; Path-scoped rules; Tuning; Template ownership and lifecycle checks | the new skill, moved without rewriting |
| Known limits | the new skill, moved without rewriting |

## Goal

After onboarding, the repository's front page describes the project, and the operating knowledge
is kept once, in a skill, instead of in a README that is thrown away.

## Non-goals

- Re-verifying what the moved sections claim (for example that `/repair` was only tested against a
  fake `claude`). They move as written; a claim that has gone stale is found by whoever reads it.
- Cutting sections out of documents when an optional track is disabled (separate ADR). Moved text
  that mentions a track keeps doing so until that exists.
- Migrating projects onboarded before this change.
- Rewriting the skills the template README will link to.

## Users and triggers

A maintainer choosing the template (reads the shorter README); `/onboard` reaching phase 7; an
agent about to change `.claude/gates.json`, the track manifest or the adapter (loads the skill).

## Acceptance criteria

The skill:

1. The repository shall contain a core skill whose files hold the sections marked "the new skill"
   in the table above, moved without rewriting except for relative links, registered in
   `.claude/tracks.json`, with a `description` saying to read it before changing gates, tracks,
   agent scopes or the adapter.
2. Each moved section's heading shall appear in the skill and not in the template README, and a
   regression test shall check both.

The template README:

3. The template `README.md` shall be at most 140 lines, keep the intro, Quick start, layer table,
   commands table and scope, give each of design, code standard, security and infrastructure at
   most three sentences and a link, and link to the new skill.

The project README:

4. The repository shall contain `docs/_project-readme.md`, at most 60 lines, with a purpose
   paragraph under the title and the sections Status, Run it, Layout, Documentation, Working with
   agents and Conventions, and a fill-in instruction for each saying which document the content
   comes from.
5. When `/onboard` reaches phase 7, it shall replace `README.md` with one written from the stub,
   after phase 6 has run the commands, shall take every sentence from a document that already
   exists, shall list only commands phase 6 ran, shall write `<!-- TODO: question -->` where a fact
   is not known, shall mention no disabled track, and shall delete the stub.
6. The phase 5 instruction to review prose references "in README, AGENTS and commands" shall name
   `AGENTS.md` and the commands only, since the README is replaced in phase 7.

The checks:

7. If onboarding is `completed` and the first heading of `README.md` is `# agent-project-starter`,
   then `npm run lint:docs` shall fail naming `README.md`.
8. If onboarding is `completed` and `docs/_project-readme.md` still exists, then
   `npm run lint:docs` shall warn.
9. If a relative link in the root `README.md` points at a file that does not exist, then
   `npm run lint:docs` shall fail naming the link.

## Security

No new entry point, data or role. The project README is public text: the stub tells the agent to
write no tokens, keys, internal hostnames or connection strings, and the linter's secret scan
already covers `README.md`. Moving the known-limits section into a skill keeps the sandbox and
permission caveats in front of an agent that edits `.claude/settings.json`, which is where they
matter; nothing in it is reworded.

## Out of band

none

## Open questions

- [x] Name and split of the skill. Decided by the maintainer: `gates-and-tracks`, with
  `SKILL.md` (when to read it, the advisory stage, the idea behind the gates, tuning, things that
  must not quietly come back), `limits.md` (known limits) and `lifecycle.md` (ownership and the
  adapter, agent scopes, path-scoped rules, repair).
- [x] Should the project README copy the install, run and test commands from `AGENTS.md`, or link
  to them? Decided by the maintainer: copy only the commands phase 6 ran; `AGENTS.md` stays the
  source, and the duplication is named in the stub as a drift risk.

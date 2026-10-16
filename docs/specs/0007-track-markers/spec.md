---
type: spec
id: "0007"
status: done
date: 2026-10-15
owner: maintainers
adrs: ["0021", "0015"]
ui: false
design: null
---
# 0007 - Markers that cut optional-track text with the track

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

[ADR 0021](../../decisions/0021-mark-optional-track-text-and-cut-it-with-the-track.md) decided that
text which exists only for an optional track is marked, and cut by the adapter when the track is
disabled. Today a disabled track leaves behind prose that names its agents, skills, commands and
workflows: about a dozen places in eight files (`harden.md`, `ship.md`, the security rulebook's
scanner table, `docs/ops/environments.md`, `AGENTS.md`, the Next.js and NestJS + Nuxt packs,
`docs/INDEX.md`). The adapter removes only Markdown links, one line at a time, and nothing reports
the rest, so the derived project keeps references to files that no longer exist.

The places come in two shapes that a marker has to fit: whole sections or list items, and single
rows of a table, where a marker on its own line would split the table. Cutting must also be safe:
the constitution's principles are not track-specific and no mechanical edit may remove one.

## Goal

Disabling a track removes its prose with its files, the linter finds any mention of a disabled
track that is not marked, and the template's own places are marked so that `npm run test:derived`
proves it.

## Non-goals

- Migrating projects onboarded before this change.
- Checking that the text left after a cut still reads well (an empty heading, a sentence whose
  subject was cut). That stays with review; the spec only limits what may be marked (criterion 11).
- Markers in files the manifest owns by track (they are removed whole), in YAML or JSON, or in
  history documents (`docs/decisions/`, `docs/specs/`, `docs/log.md`).
- Renumbering lists. Numbered steps are not marked (criterion 11).
- Any change to which track owns which file.

## Users and triggers

A maintainer or agent running `node scripts/adapt-template.mjs --disable <tracks>` during
onboarding; anyone running `npm run lint:docs` or `npm run test:derived`; an author adding text that
is true only when a track is kept.

## Acceptance criteria

Grammar and the adapter:

1. When the adapter disables track `NAME`, it shall remove from each scanned Markdown file every
   block that starts with a line holding only `<!-- track:NAME -->` and ends with the next line
   holding only `<!-- /track:NAME -->`, marker lines included, and every line that ends with
   `<!-- track:NAME -->` after other text.
2. When a track is kept, the adapter shall leave its markers and the text between them unchanged.
3. The adapter and the linter shall ignore markers inside fenced code blocks.
4. The adapter shall cut marked text before it removes lines that link a removed file, in the
   files it scans today plus `AGENTS.md`, the commands, the agents and the rules, and the plan it
   prints without `--confirm` shall list every file it would edit.
5. The adapter shall not cut text in `docs/decisions/`, `docs/specs/` and `docs/log.md`, nor in
   `.claude/commands/onboard.md`, which names every track as part of its job. (The exemption for
   `/onboard` was added while implementing: without it, criterion 8 would fail the onboarding
   command itself, or its instructions would be cut in the middle of an onboarding.)

The linter:

6. If a scanned file has an opening marker with no closing marker, a closing marker with no opening
   marker, a block inside another block, or a marker naming a track that is not in
   `.claude/tracks.json` or is `core`, then `npm run lint:docs` shall fail, naming the file and line.
7. If `AGENTS.md` has a marker between the heading of its section 2 and the heading of its section
   3, then `npm run lint:docs` shall fail.
8. While a track is disabled in `.claude/tracks.json`, `npm run lint:docs` shall fail for each line
   in a scanned file that names one of its assets (a skill directory, agent, command, workflow
   base name or scope profile it owns) outside a marker, a fenced code block, a Markdown link, a
   history document and `/onboard`.
9. Where a line ends with `<!-- track-ok: <reason> -->` with a reason of at least ten characters,
   the check in criterion 8 shall skip that line.

Tests:

10. When `npm run test:derived` has disabled every optional track, it shall pass the check in
    criterion 8, and the adapted `harden.md` shall name neither `infra-reviewer` nor
    `design-reviewer`, the adapted `AGENTS.md` shall name neither `/infra` nor `design-reviewer`, and
    `docs/INDEX.md` shall have no Design section.

Authoring and the template's own text:

11. The template shall hold marked text only as a whole paragraph, list item, table row or section,
    and shall not mark numbered steps; `.claude/rules/` shall have a rule, loaded for Markdown
    under `.claude/` and `docs/` and for `AGENTS.md`, that says so and links the grammar.
12. Each place named in the Problem section, and the line in
    `.claude/skills/gates-and-tracks/limits.md` that says the infrastructure track is unproven,
    shall be marked, or reworded so that it names no asset of an optional track.
13. `.claude/skills/gates-and-tracks/lifecycle.md` shall describe the grammar once, and
    `/onboard` phase 5 shall say the adapter cuts marked text and that only unmarked prose is
    reviewed by hand.

## Security

The adapter writes to more files than before (`AGENTS.md`, the commands, the agents, the rules) and
deletes text from them. Two things keep that safe. It runs only when a human runs it with an
explicit `--disable`, and without `--confirm` it prints the files it would edit (criterion 4). And a
marker cannot hide a principle: markers are rejected in section 2 of `AGENTS.md` (criterion 7), and
`/harden` and `/ship` keep their security steps outside any marker, which criterion 12 checks in
review. Under the sandbox the adapter's write preflight already refuses protected paths and lists
them ([spec 0003](../0003-adapter-safety-and-guard-false-positives/spec.md)); nothing here widens
what it may touch (`safePath` is unchanged).

## Out of band

none

## Open questions

- [x] Which names count as assets in criterion 8, and what is the escape? Decided by the
  maintainer: derived from `.claude/tracks.json` with no new data (the directory name of each
  owned skill that owns its `SKILL.md`, each owned agent and command, the base name of each owned
  workflow, each owned scope profile); the escape is `<!-- track-ok: reason -->` on the line.
- [x] `/harden` lists its checks as numbered steps, and steps 7 (user interface) and 8
  (infrastructure) belong to tracks. Decided by the maintainer: unnumbered conditional items under
  one step. Implemented differently, with the reason: one shared step would be left with an empty
  body when both tracks are cut, so each track's checks became their own marked section before
  `## Steps`, and the numbered steps were renumbered without them (nothing else referred to
  their numbers).

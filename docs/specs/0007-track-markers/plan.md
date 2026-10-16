---
type: plan
spec: "0007"
status: done
date: 2026-10-15
---
# 0007 - Implementation plan

## Approach

One module, `scripts/track-markers.mjs`, owns the grammar so the adapter and the linter cannot
disagree about it: `scanMarkers` (grammar problems), `cutMarkers` (what the adapter removes),
`trackAssets` (names a track owns, derived from `.claude/tracks.json`) and `leftovers` (lines that
name a disabled track's assets outside a marker). All of them skip fenced code blocks, and a block
that opens inside a fence is not a block.

The adapter runs `cutMarkers` for every disabled track on each scanned Markdown file, before its
line-by-line removal of links to removed files, and the preview already lists the edited files. The
scanned set grows from skills, docs and the README to also `AGENTS.md`, the commands, agents and
rules; decisions, specs, the log and `/onboard` are never cut. The linter checks the grammar
everywhere, rejects a marker in section 2 of `AGENTS.md`, and, for a disabled track, fails on each
leftover name.

The template's own places are marked or reworded. Table rows take the one-line form with the marker
after the final pipe. Text that is part of a numbered list or of a sentence is moved to its own
paragraph or section first. `/harden`'s two track checks became marked sections before `## Steps`
and the steps were renumbered, since a single shared step would be empty when both tracks go
[OVERRIDE: the spec's proposed "unnumbered items under one step" leaves an empty step when both
tracks are cut]. [OVERRIDE: criterion 8 would fail `/onboard`, whose job is to name every track, so
it is exempt, like the history documents.]

## Files touched

| Path | Change | Risk |
|---|---|---|
| `scripts/track-markers.mjs` | new | medium |
| `scripts/adapt-template.mjs` | cut marked text, wider scan | medium |
| `scripts/lint-docs.mjs` | grammar, section 2, leftover check | medium |
| `scripts/test-regressions.mjs`, `scripts/test-derived.mjs` | cases for criteria 1-10 | low |
| `.claude/rules/track-markers.md`, `.claude/skills/gates-and-tracks/lifecycle.md` | author rule, grammar | low |
| `.claude/commands/harden.md`, `ship.md`, `onboard.md` | marked sections, phase 5 sentence | medium |
| `.claude/skills/security-rulebook/scanners.md`, `infra-setup/SKILL.md`, `engineering-rulebook/nextjs.md`, `nestjs-nuxt.md`, `gates-and-tracks/limits.md` | marked | low |
| `AGENTS.md`, `README.md`, `docs/INDEX.md`, `docs/ops/environments.md` | marked or reworded | medium |
| `.claude/tracks.json`, `docs/log.md` | register the rule, the spec | low |

## Data changes

none

## Decisions required

None beyond [ADR 0021](../../decisions/0021-mark-optional-track-text-and-cut-it-with-the-track.md),
which this implements.

## Test strategy

Regression cases drive the adapter and the linter in fixture copies: cutting and keeping, fences,
history files, every grammar error, section 2, each way a leftover is found or excused. Two more
disable `infra` and `design` one at a time on the real template text and check that nothing of the
disabled track is left, that the other track's text and markers are, and that `AGENTS.md` still
holds its budget and its eight principles; that is the only place the Next.js and NestJS + Nuxt
packs are exercised with design off. `test:derived` disables every optional track and now asserts
the same for `harden.md`, `AGENTS.md` and `docs/INDEX.md`. Whether the text left after a cut still
reads is review; a first real onboarding that drops a track is the check for that.

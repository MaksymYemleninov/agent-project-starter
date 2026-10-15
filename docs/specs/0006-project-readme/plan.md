---
type: plan
spec: "0006"
status: done
date: 2026-10-15
---
# 0006 - Implementation plan

## Approach

Move first, then shrink. The sections the spec marks "the new skill" are copied into
`.claude/skills/gates-and-tracks/` (`SKILL.md`, `limits.md`, `lifecycle.md`) as they stand, and a
check compares them with the README they came from before the README is cut. Then the template
README is rewritten to at most 140 lines: intro, Quick start, layer table, commands table and scope
as they are, the four capability sections reduced to one single-line bullet each (so the adapter
can drop a whole bullet when its track is disabled) and a link to the skill.

The project README is a stub, `docs/_project-readme.md`: a purpose paragraph and six short sections, each with the
document its content must come from, and the rules the spec lists (only existing documents, only
commands phase 6 ran, a TODO comment for the unknown, no disabled track, no secrets). `/onboard`
phase 7 gets a step that writes `README.md` from it and deletes it, and the phase 5 line about
reviewing README prose is narrowed.

Checks in `scripts/lint-docs.mjs`: a completed onboarding with the template's heading in
`README.md` is an error, a leftover stub is a warning, and relative links in the root `README.md`
are checked outside code fences. The adapter's link-line cleanup covers `README.md` too, so the
link check holds in a project whose optional tracks are gone.

[PROPOSED: one-line bullets for the capability links, because the adapter cleans by line.]

## Files touched

| Path | Change | Risk |
|---|---|---|
| `.claude/skills/gates-and-tracks/SKILL.md`, `limits.md`, `lifecycle.md` | new, moved README sections | low |
| `README.md` | cut to at most 140 lines, links the skill | medium |
| `docs/_project-readme.md` | new stub | low |
| `.claude/commands/onboard.md` | phase 7 step, phase 5 line | medium |
| `scripts/lint-docs.mjs` | three README checks | medium |
| `scripts/adapt-template.mjs` | link cleanup includes `README.md` | medium |
| `.claude/tracks.json` | register the skill files as core | low |
| `scripts/test-regressions.mjs` | cases for criteria 2-4, 7-10 | low |
| `docs/INDEX.md`, `docs/log.md` | register the spec, entry | low |

## Data changes

none

## Decisions required

None beyond [ADR 0020](../../decisions/0020-write-the-project-readme-instead-of-inheriting-the-templates.md),
which this implements.

## Test strategy

Regression cases: each moved heading is in the skill and not in the README; the README is within
140 lines and links the skill; the stub is within 60 lines and has its seven headings; the lint
cases for completed onboarding, a leftover stub and a broken README link; the adapter removing a
README line that links a removed file. The text of the move itself is checked once, by comparing the
skill's sections with the template README as it was, before this change (task 2); no test keeps
the old README around. That `/onboard` follows the new step is checked by a presence test on the
command, as for spec 0004, and by the next real onboarding.

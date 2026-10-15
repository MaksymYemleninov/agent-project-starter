---
type: plan
spec: "0005"
status: done
date: 2026-10-15
---
# 0005 - Implementation plan

## Approach

Python pack: add a "Starter configuration" subsection under "Boundary rules" with one TOML block
(one contract per row of the boundary table, plus the external-package case), state the version
floors (2.6 for `acyclic_siblings`, 2.1 for wildcards in `forbidden`), and add a short macOS
section for the hidden `.pth` trap. Every option name comes from import-linter's documentation as
read on 2026-10-15 (see the spec's Sources); nothing is pinned. A regression test parses the block
as text and checks the contract types against the known list and the external-package setting.

Constitution: bring `AGENTS.md` from 163 to 145 lines, by the linter's count, only by merging
table rows (repository map, commands) and tightening prose in sections 3 to 7. Sections 1, 2 and
8 are untouched. Principle numbers and the four onboarding blocks stay, and a test checks them
because hooks cite `AGENTS.md` section 2.3 and 2.6. `/onboard` phase 5 gets the six-line cap for
stack principles. The working agreement stays in the file by [ADR 0009](../../decisions/0009-working-patterns-in-the-constitution.md).

## Files touched

| Path | Change | Risk |
|---|---|---|
| `.claude/skills/engineering-rulebook/python.md` | starter block, version floors, macOS note | low |
| `AGENTS.md` | merged table rows, tightened prose, 163 to 145 lines | medium |
| `.claude/commands/onboard.md` | six-line cap for stack principles | low |
| `scripts/test-regressions.mjs` | pack block test, constitution anchors test | low |
| `docs/INDEX.md`, `docs/log.md`, `.claude/tracks.json` | register the spec | low |

## Data changes

none

## Decisions required

None. No principle or boundary changes, and ADR 0009 stands.

## Test strategy

Two regression cases (pack block, constitution budget and anchors). They prove the block uses
known contract types and the right setting, and the file stays in budget with its anchors; they do
not run `lint-imports` against a real project, which needs a Python environment this template does
not have. The first project to use the block proves each contract red once, as the pack says.

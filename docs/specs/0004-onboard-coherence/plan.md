---
type: plan
spec: "0004"
status: done
date: 2026-10-14
---
# 0004 - Implementation plan

## Approach

Two kinds of change. The linter (criteria 1-4) is code with tests. `/onboard`, `writing-spec`
and the `infra-architect` description (criteria 5-10) are prose that the agent follows; they are
checked in review and by a small regression test that the required statements exist, so a later
edit cannot silently drop one.

Linter: before counting markers, strip `<!-- TODO: ... -->` comments (single-line or multi-line)
from the document text, then count the rest as today. `deferred` joins the status list for
product, architecture, ops, security and design documents; for it the `adr` frontmatter value is
resolved against `docs/decisions/` (a file name, with or without `.md`, or a four-digit id) and a
missing or unresolvable value is an error. A `deferred` document is not reported as a template.

`/onboard`: a new first step in phase 4, "Preflight the environment", before the stack table. The
agent derives the checks from the candidates it is about to propose: the tool and its version
(`command -v`, `--version`), whether the service runs (a daemon status call), and whether the
sources it will cite are reachable (a request to each, read as `ok` or `unreachable` from the
result, never predicted). Results go to `environment` in `.claude/onboarding.json` as
`ok | missing | unreachable | not checked`; unverified values are written as
`<!-- TODO: verify <value> at <source> -->` and listed in one line of the stack ADR. The
infrastructure criterion, the protected-path notice for phase 5 and the persistence-deferred
status for `data-model.md` are single paragraphs in their phases. Phase 7 and `writing-spec` get
one matching sentence each. [PROPOSED: a fixed host list built from the candidates, as the
maintainer decided in the spec, rather than a field in every pack.]

Departure from the current template: the first spec's `plan.md` and `tasks.md` are cut as
`draft` in phase 7. [OVERRIDE: phase 7 requires the first spec at once; `writing-spec` order is
kept for every later spec.]

## Files touched

| Path | Change | Risk |
|---|---|---|
| `scripts/lint-docs.mjs` | marker split, `deferred` status and `adr` check | medium |
| `scripts/test-regressions.mjs` | linter cases 1-4, statement checks for 5-10 | low |
| `.claude/commands/onboard.md` | preflight step, unreachable-source rule, infra criterion, protected edits, data-model status, phase 7 | medium |
| `.claude/agents/infra-architect.md` | Mode 0 wording | low |
| `.claude/skills/writing-spec/SKILL.md` | the first-spec exception | low |
| `.claude/onboarding.json` | `environment` key | low |
| `docs/INDEX.md`, `docs/log.md`, `.claude/tracks.json` | register the spec | low |

## Data changes

`environment` added to the onboarding checkpoint, default `null`. No migration: a checkpoint
without it is valid.

## Decisions required

None. The `deferred` status extends a vocabulary the linter owns and is reversible; if review
disagrees, it becomes an ADR before merge.

## Test strategy

Linter cases run against the fixture copy of the repository used by the regression suite: a
document with only commented markers, one with a bare marker, a `deferred` document with a valid
and with a missing or unknown `adr`. The prose criteria are covered by a test that reads the
three files and checks each required statement is present (preflight step before the stack
table, the unreachable-source rule, the ownership wording in both `onboard.md` and
`infra-architect.md`, the protected-path notice, the `deferred` instruction, the first-spec
exception). That test proves presence, not that an agent obeys it; the agent's behaviour is
verified by the next real onboarding and said so in the log.

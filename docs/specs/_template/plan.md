---
type: plan
spec: "NNNN"
status: draft
date: YYYY-MM-DD
---
# NNNN - Implementation plan

## Approach

How this gets built, in two or three paragraphs. Name the modules that change and the ones that
deliberately do not.

Tag departures from the project's defaults where they are made: `[OVERRIDE: requirement]` if the
spec forces one, `[PROPOSED: reason]` if it is the author's own idea. For infrastructure, use the
plan format in `.claude/skills/infra-rulebook/plan-format.md` instead of this template.

## Files touched

| Path | Change | Risk |
|---|---|---|
| TBD | new / modify / delete | low / medium / high |

## Data changes

Schema, migration, backfill. If none, write "none" rather than omitting the section.

## Decisions required

Anything in this plan that meets the ADR test from
[ADR 0000](../../decisions/0000-record-architecture-decisions.md) gets an ADR before
implementation starts, not after. List them here with their numbers.

- TBD

## Test strategy

What is covered by unit tests, what needs integration, what is only verifiable by hand and why
that is acceptable.

## Rollout

Flag, staged, or straight to production. How it is turned off if it misbehaves.

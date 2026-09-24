# Infrastructure plan format

The infrastructure plan is the `plan.md` of an infrastructure spec, written by `infra-architect`.
The engineer builds from it and the reviewer checks against it, so the sections are fixed and the
headings verbatim. Anything that fits nowhere goes in Open items or is left out.

## Full plan (new infrastructure or a new environment)

```markdown
---
type: plan
spec: "NNNN"
status: draft
date: YYYY-MM-DD
---
# NNNN - Infrastructure plan

## 1. Versions

| Component | Source | Version | Resolved from | Resolved on |
|---|---|---|---|---|
| terraform or tofu CLI | - | x.y.z | releases API | YYYY-MM-DD |
| terragrunt CLI (if used) | - | x.y.z | releases API | YYYY-MM-DD |
| vpc | registry path | x.y.z | registry API | YYYY-MM-DD |

## 2. Architecture

An ASCII diagram of what exists and how traffic and data move. Draw what this project has, not a
generic reference architecture.

## 3. Environments and regions

| Environment | Purpose | Account / project | Region(s) | Network range | Notes |
|---|---|---|---|---|---|

## 4. Components

One row per distinct component, not per environment.

| Path | Component | Module | Version | Shared config | Differs per environment | Scope |
|---|---|---|---|---|---|---|

## 5. Directory structure

The full annotated tree, following layout.md. One short comment per line: module and version on
shared config, only the overrides on leaves.

## 6. Dependency graph

`component <- dependency, dependency`, logical dependencies only. The engineer orders batches and
writes mock outputs from this.

## 7. Apply order and rollback

The order the human applies in, which steps are one-way (a database created with a name that
cannot change, a DNS delegation), and how each is undone.

## 8. Decisions required

Every foundation choice as a proposed ADR, by number: tool, layout, state backend, environment
and account model, region, naming. The plan is not approved while one is still `proposed`.

## 9. Open items

| # | Item | Why the engineer cannot decide it | Who answers |
|---|---|---|---|
```

Values given in the spec are used directly, not turned into open items. Open items are what was
genuinely not provided and blocks a correct build: an IP allow-list, a key, an account id, a
choice between two shapes the rulebook allows.

## Change analysis (a change to existing infrastructure)

Smaller, written into the `plan.md` of the change's spec:

```markdown
# NNNN - Change analysis

## Summary
What changes and why, in two sentences.

## Affected components
- `infra/live/prod/.../network/` - what changes

## New components
| Component | Module | Version | Resolved from | Notes |

## Dependency impact
New or changed dependencies, mock outputs to add.

## Files to change
- path - reason

## Plan expectation
What `plan` should show when this is right: N to add, N to change, 0 to destroy. The engineer
compares against it; a mismatch is a finding, not a surprise.

## Pending approval
The human replies "approved" before the engineer starts.
```

## Tags

Every deviation from the rulebook is tagged where it is made, per section 10 of the rulebook:
`[OVERRIDE: requirement]` or `[PROPOSED: reason]`. An untagged deviation is a review finding.

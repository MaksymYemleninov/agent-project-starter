---
name: infra-change
description: Make a change to existing infrastructure code - a version bump, an input change, a new component or service, a sizing change, a removal. Sizes the change into a tier and runs only the agents that tier needs, from infra-engineer alone to architect, engineer and reviewer. Use when the user asks to add, change, update, upgrade, remove or rename something in an existing Terraform, OpenTofu or Terragrunt tree.
---

# Infrastructure change

Most infrastructure changes touch one component and need one agent. This skill decides which case
this is before anyone writes anything, because a change that looks trivial ("bump the database
class") is sometimes not (the database does not exist in that environment yet).

Spawn discipline is the same as in `infra-bootstrap`: one sentence and file paths, never pasted
content.

## Phase 0: guard and orientation

**Guard.** No IaC tree (nothing under `infra/`, nothing matching `infra.paths` in
`.claude/gates.json`)? Stop and offer `infra-bootstrap`. There is nothing to change.

**Orient before triage**, reading only what the request touches:

1. List the units: every `terragrunt.hcl`, or every root module, and the shared configuration.
   `infra-rulebook/layout.md` says how to read an unfamiliar tree.
2. The infrastructure spec and its `plan.md` that built this area, and the accepted ADRs tagged
   `infra`. A change that contradicts a tagged `[OVERRIDE]` or `[PROPOSED]` decision needs the
   architect before the engineer.
3. `docs/ops/environments.md` and the part of `docs/architecture/overview.md` that covers it.

## Phase 1: disambiguate

A complete request ("bump the network module to 5.2.1 in all environments") skips this. A vague one
("add caching", "make staging highly available", "set up monitoring") does not: read the rulebook
pages for the domain first, then ask one question at a time about what the rulebook does not
default. Record the answers in the change's spec if there is one (Tier 2), or restate them in one
line to the human before starting (Tier 1).

## Phase 2: triage, exactly one tier

**Tier 1 - edit to something that exists.** A version bump, one input, one new dependency, removing
an unused input. No new component, no new environment.
Route: `infra-engineer` Mode A, then documents.

**Tier 2 - something the project does not have yet.** A new service, component or module shape,
or a new cross-environment dependency.
Route: a spec (`/spec`), `infra-architect` Mode 2 into its `plan.md`, human approval,
`infra-engineer` Mode A, documents, and `infra-reviewer` Mode 2 if three or more components were
touched.

**Tier 3 - the shape of the infrastructure moves.** A new environment, region or account, a change
of state backend, naming convention or IaC tool, removing a whole category of service, or anything
that contradicts an accepted infrastructure ADR.
Route: not here. Say which of these it is, and offer the two real paths: an ADR superseding the
decision it changes, then `infra-bootstrap` scoped to the new environment, or a revised spec and a
fresh architect pass. The day-to-day assumption, that the existing plan and decisions still hold,
is exactly what a Tier 3 change breaks, and the ADR gate will ask for the record anyway because
these are `infra.foundations`.

## Tier 1

1. Spawn `infra-engineer`, Mode A, with the request in the human's words and the file paths.
2. It returns the files changed and the plan result. Anything but a clean plan matching the request
   goes back to the human, not into a retry.
3. Documents: update `docs/ops/environments.md` or the overview only if what they say is now
   untrue, plus a `docs/log.md` entry.
4. Pass on its **For the human, before apply** block.

## Tier 2

1. Write and approve the spec.
2. Spawn `infra-architect`, Mode 2, with the spec path. Add any ADR it proposed to `docs/INDEX.md`.
3. Present the change analysis and wait for **approved**. Answers loop back through the architect,
   as in the bootstrap approval gate.
4. Spawn `infra-engineer`, Mode A, with the spec path. It builds every artifact the rulebook places
   with the new component in one pass and plans each.
5. Three or more components touched: `infra-reviewer` Mode 2, at most two cycles, fix passes in
   between. Link the `review.md` it creates from the spec, or the linter reports it unreachable.
   Fewer: the engineer's plans and the human's own review of the plan before apply are enough,
   unless the human asks for review.
6. Documents, log, and the engineer's **For the human, before apply** block.
7. Rule gaps: anything a fix loop or the review found that no rule covered, as one-line
   candidates for the human to accept or decline. Write none without a yes.

## What this skill never does

- Handles a Tier 3 change quietly.
- Loops the reviewer on a Tier 1 change.
- Rewrites the `plan.md` of the spec that built the area. That plan records what was decided then;
  a change gets its own spec and its own analysis.
- Applies. The human does.

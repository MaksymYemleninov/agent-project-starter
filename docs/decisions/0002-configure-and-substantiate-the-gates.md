---
type: adr
id: "0002"
status: accepted
date: 2026-09-18
deciders: [maintainers]
tags: [process, tooling, security]
supersedes: null
superseded_by: null
---
# 0002 - Configure the gates, and check ADR substance

## Context

[ADR 0001](0001-enforce-documentation-in-ci.md) put the documentation rules into hooks and CI.
Reviewing that work afterwards surfaced four ways the enforcement was weaker than it looked, all
of the same shape: a check that reports success while measuring the wrong thing.

The source-path list was hardcoded to `src/`, `app/`, `lib/` and other JavaScript conventions.
On a Python or Go project none of those match, so the Stop hook would report no source changes
forever and nobody would notice, because silence is what success looks like.

The ADR gate proved a file existed. A file containing "We need a database. / Postgres. / Pros:
good, Cons: none" satisfied it completely, and that is exactly what gets written when someone is
trying to get past a gate rather than record a decision.

`permissions.deny` on `Read(./.env)` blocked the Read tool while `Bash` remained available, so
`cat .env` walked around it. The rule was documentation of an intention, not a control.

`/onboard` runs a long interactive sequence and kept no state, so a session that died in phase 4
started again at phase 1, re-asking questions and rewriting documents the user had already
approved. The cost of that is not wasted time; it is that the user stops trusting the command.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave it, document the gaps in the README | Honest, zero work | A documented hole is still a hole, and readers skip it | Low |
| Harden in code, keep everything hardcoded | Simple, one place to read | Wrong for every project whose layout differs, which is most of them | Low |
| Move tuning into config, add substance checks, guard the shell path, checkpoint onboarding | Each check now measures what it claims | Four more moving parts; config can drift from reality | Low |
| Adopt an off-the-shelf policy engine | Mature, expressive | A dependency and a language to learn, for five rules | Medium |

## Decision

We make the gates configurable and raise what they actually verify.

`.claude/gates.json` holds the tuning: source paths, dependency manifests, guardrail paths, the
Stop hook thresholds, and the secret-bearing path patterns. `/onboard` rewrites the first two for
the chosen stack in phase 5. Matching uses a small glob converter in `scripts/changed-files.mjs`
rather than a dependency, because the gates must keep working before any stack exists.

The ADR linter now enforces a substance floor: a Context section of at least 200 characters of
prose, at least two options considered, a non-empty negative consequence, and no leftover template
placeholders. These are minimums, not quality measures.

A `PreToolUse` hook denies shell commands that reference secret-bearing paths, with `.env.example`
and its siblings allowlisted. It tokenizes the command and tests the tokens, so prose in a commit
message does not trip it.

`.claude/onboarding.json` checkpoints `/onboard` after every phase, recording the phase reached and
anything agreed but not yet written. A new session resumes from there.

Required documents are split in two: a structural core that must exist, and an expected set that
warns when missing, because an internal tool with one user does not need personas and a stateless
service does not need a data model.

## Consequences

### Positive

- Every check now measures the thing it claims to measure, on projects that are not JavaScript.
- The empty-shell ADR, the most likely way this practice decays, fails at the gate instead of at
  review, or at nothing.
- The secret rule covers the path an agent actually takes.
- A dying session costs the phases not yet reached, rather than the whole onboarding.

### Negative

- The secret guard will produce false positives. A command that legitimately mentions a
  secret-shaped filename is denied and the author has to narrow it. This was chosen deliberately
  over a permissive default, but it is a real cost paid on ordinary work.
- Minimum-length checks are gameable by anyone who wants to game them: 200 characters of filler
  passes. The floor catches carelessness, not bad faith, and pretending otherwise would repeat the
  exact mistake this record is about.
- `.claude/gates.json` can drift from the repository layout. Nothing detects a `sourcePaths` entry
  that stopped matching anything, so the failure mode of the original bug survives in a narrower
  form.
- Four more files to understand before someone can change how the gates behave.
- Onboarding state is a second place where "where are we" is recorded, and it can disagree with
  reality if a phase is done by hand. The linter cross-checks the completed state against
  `AGENTS.md`, which covers the common case and not all of them.

### Follow-ups

- If `sourcePaths` drift becomes a real problem, add a check that warns when a configured glob
  matches nothing in the repository.
- Revisit the secret guard's token matching if false positives become routine rather than rare.

## Revisit when

A project using this template finds itself editing `scripts/` to change gate behavior. That means
the config is missing a knob, and the fix is to add the knob, not to fork the script.

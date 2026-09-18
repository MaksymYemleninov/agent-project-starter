---
type: adr
id: "0000"
status: accepted
date: 2026-09-18
deciders: [maintainers]
tags: [process, documentation]
supersedes: null
superseded_by: null
---
# 0000 - Record architecture decisions

## Context

Most of the code in this repository will be written by agents. An agent reads the code as it is
and has no access to the discussion that produced it. Given a piece of code whose reason is not
visible, the rational move for an agent is to simplify it, and it will. Every constraint that
lives only in someone's memory is therefore a constraint that gets refactored away, usually
quietly, usually at the worst time.

Comments do not solve this: they explain a line, not a choice between alternatives. Commit
messages do not either: nobody searches them, and agents do not read git history by default.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Nothing, rely on code review | No overhead | Reviewer needs the same missing context | Low |
| Comments at the call site | Close to the code | Cannot hold alternatives or consequences | Low |
| Wiki or external doc tool | Nice editing | Drifts, not in the agent's context window | Medium |
| ADRs in the repository | In-context, versioned with the code, reviewable in the same PR | Discipline required, enforced by CI here | Low |

## Decision

We record architecture decisions as numbered Markdown files in `docs/decisions/`, following the
template in `_template.md`. Records are append-only: a decision that turns out wrong gets a new
ADR with `supersedes`, and the old one gets `status: superseded` and `superseded_by`. Nothing is
edited away.

A change needs an ADR when at least one of these is true:

1. It is expensive to reverse.
2. It crosses a boundary between components.
3. It will look arbitrary to someone who was not in the conversation.

If none of the three holds, do not write one. An ADR for every commit is noise, and noise is what
kills the practice.

## Consequences

### Positive

- The reasoning sits in the same repository the agent already has open.
- Reviewers argue about the decision in the pull request that makes it, not six months later.
- Onboarding a new agent, model or human is reading `docs/decisions/` in order.

### Negative

- Writing a good Context section takes real thought and cannot be automated away.
- Numbering creates merge conflicts on parallel branches. Accepted: renumber on rebase.
- There is a standing temptation to write ADRs for trivia. The three-part test above is the only
  defense, and it needs to be applied honestly.

### Follow-ups

- `scripts/check-adr-drift.mjs` fails a pull request that changes `docs/architecture/` or the
  dependency manifest without adding a decision record.
- `.claude/skills/writing-adr/SKILL.md` holds the procedure.

## Revisit when

The repository has more than roughly fifty ADRs and finding the relevant one becomes the
bottleneck. At that point add an index by topic rather than abandoning the practice.

---
type: adr
id: "0009"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, documentation]
supersedes: null
superseded_by: null
---
# 0009 - Move five working patterns from the infrastructure pipeline into the constitution

## Context

Building the infrastructure track in [ADR 0007](0007-optional-infrastructure-track.md) meant
writing down habits that the pipeline it came from had learned the hard way. Five of them turned
out to have nothing to do with infrastructure. They are failure modes of agents in general, and
infrastructure only makes them expensive enough to be noticed.

1. **An agent treats an environment failure as its own bug.** Given an expired credential or a
   missing binary, the rational next step for an agent is to change something it controls, which is
   the code. The result is a change nobody asked for that hides the real problem.
2. **An agent recalls what it should look up.** Versions, limits, prices and API shapes come from
   the training data, confidently and out of date. The template already said "pin versions"; it did
   not say where the version should come from.
3. **Nobody can tell the agent's own ideas from the requirements.** A plan mixes what the spec
   asked for with what the author thought was a good addition, and a reviewer cannot tell a
   deliberate departure from a mistake. Tagging each departure when it is made, as `[OVERRIDE]` or
   `[PROPOSED]`, solved that in the pipeline.
4. **Change size is not decided up front.** The constitution said "spec if more than one file",
   which sizes by file count. A one-file change that moves a boundary is the dangerous one, and it
   went through as small.
5. **Lessons stay in the session.** The same gotcha is rediscovered by the next fix loop, because
   nothing turns it into a rule. The pipeline ended every run by listing rules it had wished for,
   and let the human choose which to write.

Two smaller ones come with them: documents state only what was verified, with the rest marked as a
question, and a review loop stops after two cycles and hands the remainder to a human.

The constraint is the 200-line limit on `AGENTS.md`, which exists because every line there costs
context in every session.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep them inside the infrastructure track | No growth of the constitution | They apply to every project, and application-only projects delete the track on day one | Low |
| A new always-loaded rule file | Keeps `AGENTS.md` short | An unscoped rule is exactly what the linter warns about: same context cost, less visible | Low |
| One line or short item each in `AGENTS.md`, detail in the skills and agents that use them | Seen by every session; detail loaded only when needed | About twenty more lines in the constitution | Low |

## Decision

We will state the five patterns in `AGENTS.md` briefly, as a new principle ("resolve, do not
recall") and as working-agreement items (size the change in three tiers, classify failures, tag
departures, name rule gaps), and put the procedure where it is used: `/ship` runs the review loop
and the rule-gap step, `/harden` asks for the gaps exploration exposed, the reviewers return
verdicts and rule gaps, and the documentation rule says to write only what was verified.

## Consequences

### Positive

- The failure modes are named in the one file every session reads, where they apply to every
  project rather than only to infrastructure.
- Rule gaps give the rules directory a way to grow from evidence rather than from guessing up
  front, which is the stance this template already takes on skills.
- `[PROPOSED]` makes the agent's own additions visible for the human to accept or cut.

### Negative

- `AGENTS.md` grows from about 130 lines to about 150. Another round like this reaches the warning
  threshold at 170.
- None of it is enforced mechanically. Tags, tiers and failure classification are prose, the layer
  known to fade in a long session. They are here because they shape judgement, which no hook
  checks.
- Tiers overlap with the spec threshold in the Stop hook, which still counts files. The two can
  disagree about whether a change needed a spec, and the hook wins by blocking.
- The rule-gap step adds a question to every `/ship`. If the answer is usually "none", the step
  gets skipped, and then it teaches skipping.

## Revisit when

A few projects have shipped through `/ship` with the rule-gap step. If it has never produced a rule
anyone kept, remove it rather than keep asking.

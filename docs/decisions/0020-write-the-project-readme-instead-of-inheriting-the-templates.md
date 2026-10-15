---
type: adr
id: "0020"
status: accepted
date: 2026-10-15
deciders: [maintainers]
tags: [onboarding, docs]
supersedes: null
superseded_by: null
---
# 0020 - Write the project's README instead of inheriting the template's

## Context

`README.md` is the template's front page: 320 lines on how the gates work, what the template
contains, its known limits and its lifecycle checks. After `/onboard` the repository is a different
thing, and the README still describes the template. In the first full onboarding of a derived
project the README was left as the template's, the mentions of a disabled infrastructure track
stayed in it, and the agent had no instruction to replace it. `/onboard` phase 5 only says to
review remaining prose references "in README, AGENTS and commands", and the adapter removes
Markdown links to deleted files, not sections of prose.

The README matters more than most files. It is what a newcomer, or a code host's page for the
repository, shows first, and a front page that describes another project is worse than a short one.

Forces on the answer:

- The template repository must keep a README of its own: it is how someone chooses the template.
- Part of the README is operating knowledge a derived project still needs: how to tune
  `.claude/gates.json`, how track ownership and the adapter work, the repair loop, the known limits.
  That is not about the template's history; the project runs the same machinery.
- Two copies of anything drift. The inherited decision record from [ADR 0006](0006-what-a-project-inherits.md)
  already summarises the gates once, and `AGENTS.md` section 3 holds a repository map; a README that
  repeats both is a third copy.
- A README can only be written truthfully after the project documents exist: purpose from the
  vision, commands from `AGENTS.md`, the layout from the architecture overview. That is phase 7 of
  `/onboard`, not phase 1.
- The template already has a convention for shapes that are not documents yet: a leading underscore
  marks a stub, renamed into place by the phase that knows the project needs it (ADR 0006).
- Conditional sections inside a document tied to an optional track are a separate problem, with
  its own decision. This record does not settle it.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave the README, tell onboarding to review its prose (today) | No work | It was tried: the project's front page stays the template's, and a reviewer cannot tell which sentences are stale | Low |
| Delete the README at onboarding and write a new one | Simplest result, no leftovers | Throws away the operating knowledge a derived project needs; it survives only upstream | Low |
| Move the template's README into `docs/` whole, write a new one | Nothing is lost | A 320-line description of the template in every project, needing frontmatter and freshness upkeep, stale as soon as the project diverges | Medium |
| Replace the README from a stub at the end of onboarding, and move the operating knowledge to a skill | Front page is the project's; the knowledge is kept once, where an agent loads it when it works on the gates; the template README shrinks to what a chooser needs | Humans do not browse `.claude/skills/`; a new stub and a new skill to maintain | Medium |
| Generate the README from scratch at onboarding, no stub | No new shipped file | The shape is invented under time pressure each run and varies between projects, the problem ADR 0006 named for stubs | Low |

## Decision

We will treat `README.md` as the project's own from onboarding: phase 7 replaces the template's
with one written from a stub, `docs/_project-readme.md`, filled only from documents that already
exist, and the template's operating knowledge moves out of the README into a core skill that the
template README links to, so nothing is kept in two places.

## Consequences

### Positive

- A derived project's front page describes the project from its first commit after onboarding.
- Operating knowledge lives once. The template README becomes shorter and the project inherits the
  same knowledge it always did, now where an agent loads it when it touches the gates, the manifest
  or the adapter.
- The stub follows ADR 0006's convention, so the linter ignores it and the shape is the same in
  every project.

### Negative

- The operating knowledge becomes agent-facing. A human who used to read it in the README has to
  look under `.claude/skills/`, and nothing points a newcomer there except the project README's
  one link.
- A written README is a document that can be wrong. The linter checks it for secrets only; a stale
  claim in it is found by a reader or not at all, unless a follow-up adds link checks.
- Projects onboarded before this change keep the template's README. There is no migration.
- The template carries one more stub and one more skill, each of which can fall behind the
  machinery it describes. Nothing checks that the skill matches the scripts.

### Follow-ups

- A spec that maps every README section to its destination: the project README, the skill,
  `AGENTS.md`, or dropped. It also writes the stub, the phase 7 step and the shorter template
  README. Not part of this decision.
- Decide separately how sections tied to an optional track are cut when the track is disabled
  (markers read by the adapter); the same mechanism could keep the template README accurate.
- Consider checking relative links in the root `README.md`, which the linter does not do today.

## Revisit when

A second project has been onboarded this way and it is clear whether anyone opened the skill, or
whether humans asked for the old README back. If the skill is not read, the knowledge belongs in
`docs/`.

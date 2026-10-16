---
type: adr
id: "0021"
status: accepted
date: 2026-10-15
deciders: [maintainers]
tags: [onboarding, tooling]
supersedes: null
superseded_by: null
---
# 0021 - Mark optional-track text and cut it with the track

## Context

An optional track is a set of files the adapter removes when the project does not need it
(`.claude/tracks.json`, [ADR 0015](0015-share-template-track-ownership.md)). The adapter also
removes Markdown links to a removed file, one line at a time. What it cannot remove is prose that
names a track's agent, skill, command or workflow without a link. After the first onboarding that
dropped the infrastructure track, such prose remained in `harden.md`, `ship.md`, the README and
the description of the engineering rulebook, and `/onboard` had only an instruction to "review
remaining prose references".

How big the problem is was measured on 2026-10-15, counting lines outside Markdown links that name
a track's own skills, agents, commands, workflows or scope profiles, in files the track does not
own and that are not data (`tracks.json`, `gates.json`), the README (replaced at onboarding by
[ADR 0020](0020-write-the-project-readme-instead-of-inheriting-the-templates.md)) or the
onboarding command itself:

- `infra` and `design` are the tracks with such text: about a dozen places in eight files
  (`harden.md`, `ship.md`, `scanners.md` in the security rulebook, `docs/ops/environments.md`,
  `AGENTS.md`, the Next.js and NestJS + Nuxt packs, `docs/INDEX.md`).
- `api`, `operations` and the stack packs have none worth cutting. The packs share one directory, so
  a name search finds nothing specific to a pack.

Two things about those places matter. Most of them are already worded conditionally ("If the
project has infrastructure code"), so what goes wrong after the track is removed is not a false
statement but a reference to something that no longer exists, which no check notices. And they come
in two shapes: whole sections (a numbered step in `/harden`, a heading in `docs/INDEX.md`), and
single rows of a table (in `AGENTS.md`), where a marker on its own line would break the table.

The constraints:

- [ADR 0006](0006-what-a-project-inherits.md) and 0015 want what a project inherits to be
  decided, not left to deletion by hand, and `npm run test:derived` already builds a project with
  every optional track disabled and runs the checks. That is a place where a leftover could fail.
- The constitution may not lose a rule to a mechanical edit. Section 2 of `AGENTS.md` is not
  track-specific and must never be cut.
- The adapter runs outside the agent's sandbox in practice; under the sandbox it already refuses
  to touch the protected paths (spec 0003), so writing to more files than before is not a new class
  of problem.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep reviewing by hand, as `/onboard` says now | Nothing to build | It was tried and left leftovers; nothing finds the next one | Low |
| Detect only: the linter reports a disabled track's names outside links | Small, no new format, finds every leftover | It tells you where, an agent still cuts by hand, and the names are common words (`/design`) so false positives need an escape | Low |
| Per-track fragments: each track ships its own hardening and review checklists, and `/harden` and `/ship` read whatever is present | Removal is deleting files, nothing to cut | A new convention and indirection in two core commands; does not reach table rows or the index section | Medium |
| Markers: wrap track-only text in `<!-- track:NAME -->`, the adapter cuts it when the track is off, and the linter finds unmarked leftovers | Handles blocks and rows, removal is exact and testable, derived test can fail on a leftover | A marker grammar to learn and keep balanced; authoring discipline for every conditional sentence; clutter on a kept track | Medium |
| Generate documents from templates at onboarding | Output is exactly right | Every shared document becomes a template with its own build step | High |

## Decision

We will mark text that exists only for an optional track with `<!-- track:NAME -->` markers, as a
block between an opening and a closing marker each on its own line, or as one line that ends with
the marker, so that the adapter cuts it when the track is disabled and keeps it, markers
included, when the track is kept, and the linter reports any name from a disabled track that is
still left outside a marker.

## Consequences

### Positive

- Disabling a track removes its prose as well as its files, and the result is the same every time.
- `npm run test:derived` can fail when someone adds track-specific text without a marker, which is
  how the problem returns otherwise.
- A project that keeps a track can still drop it later: the markers stay.
- The table rows in `AGENTS.md` and the section in `docs/INDEX.md` are covered by the same two
  forms.

### Negative

- Authors of every new conditional sentence have to remember the marker. The linter finds the
  omission only for a track that is disabled, so in the template itself (every track on) it is
  caught by the derived test, not at the edit.
- Markers stay in a project that keeps the track: comments in `AGENTS.md`, the commands and the
  index that mean nothing to a reader of that project.
- The adapter writes to more files (`AGENTS.md`, the commands, the agents). Under the sandbox that
  means the refusal and the hand-off to the human that spec 0003 already defines.
- Cutting text is mechanical. It can leave an empty heading, a list item that no longer parses, or
  a sentence whose subject was cut. The linter checks that markers are balanced and name known
  tracks; whether the text around them still reads is review.
- The name check will be wrong sometimes: `design-system` is a skill name and also two ordinary
  words. It needs an escape and a small list of names per track.
- Projects onboarded before this keep their leftovers. There is no migration.

### Follow-ups

- A spec for the grammar, the adapter change, the lint check and its escape, a rule in
  `.claude/rules/` for authors, marking the places counted above, and a derived-test case.
- `AGENTS.md`: markers allowed in the repository map and the commands table only, never in
  section 2, checked by the linter.
- The line in `limits.md` that says the infrastructure track is unproven is one of the places to
  mark.

## Revisit when

A track that is not infrastructure or design starts to accumulate prose of its own, or the marked
places run past a few dozen. Then moving the checklists into per-track fragments, which needs no
cutting, is the better shape, and this decision should be superseded by that one.

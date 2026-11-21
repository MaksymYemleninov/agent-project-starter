---
type: spec
id: "0008"
status: done
date: 2026-11-21
owner: maintainers
adrs: ["0022", "0021", "0015", "0014"]
ui: false
design: null
---
# 0008 - Preproduction track for games and creative products

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

[ADR 0022](../../decisions/0022-preproduction-before-production-for-creative-products.md) decided
that games and creative products run preproduction before any production code. Today `/onboard`
goes from product documents to a stack and a skeleton. A game built from the template got its story,
characters, art direction and a fun check only after code existed, and art and tone had to be redone.
Nothing asks for the audience's age or the humour, nothing has the human choose a look from style
frames, nothing checks that the core loop is fun with grey boxes, and nothing stops a content spec
from being approved before those exist.

## Goal

A game or creative project goes, in this order: concept and tone, story and world, art direction
with style frames the human picks, a greybox playtest the human approves, content design, and only
then the production stack, scaffold and features. A spec that ships production content cannot be
approved before the art direction and a playtest are approved. Other projects drop the track and
keep nothing of it.

## Non-goals

- Generating finished art. Style frames are compositions that fix palette, shape language and mood.
- A game engine choice. That stays a phase 4 stack decision, made after preproduction.
- Checking that production follows the style frames. That is review.
- Migrating projects onboarded before this change.

## Users and triggers

A human onboarding a game or creative product; an agent running `/onboard` or `/preprod`; anyone
running `npm run lint:docs`, `test:gates`, `test:regressions` or `test:derived`.

## Acceptance criteria

Track and lifecycle:

1. The system shall register a `preprod` track in `.claude/tracks.json` that owns
   `.claude/commands/preprod.md` and the files of `.claude/skills/preproduction/`.
2. When the adapter disables `preprod`, it shall remove the track's files and every block or line
   marked `<!-- track:preprod -->`, and `npm run lint:docs` shall find no name of the track left
   outside a marker.
3. The system shall register ADR 0022 and spec 0008 as template records, so onboarding removes them.

Order of work:

4. When onboarding phase 2 finds that the product is a game or a creative product whose look, tone
   or feel is the product, `/onboard` shall run `/preprod` after phase 3 and before phase 4.
5. The `/preprod` command shall run its stages in this order, each ending with a status in a file:
   concept and tone, story and world, art direction, greybox and playtest, content design.
6. The concept stage shall record the audience including its age range, the genre, references and
   the tone of humour before any later stage starts.
7. The story stage shall record the overall goal, the characters, a visual bible (heroes, villain,
   locations, palette) and an idea bank from which no idea is deleted.
8. The art direction stage shall produce a moodboard of linked references and two or three style
   frames of one key scene, and shall set the art direction to `stable` only when the human chooses
   a frame in the conversation.
9. The greybox stage shall build the core loop without art or dependencies outside the production
   source paths, and shall record a playtest in `docs/playtests/` that is `stable` only when the
   human has played it and approved the verdict.
10. While the art direction is not `stable` or no `stable` playtest has the verdict `fun`, `/onboard`
    shall not start phase 4.

Gate:

11. If a spec has `content: true` and status `approved`, `in-progress` or `done`, and
    `docs/preprod/art-direction.md` is missing or not `stable`, then the linter shall fail.
12. If a spec has `content: true` and status `approved`, `in-progress` or `done`, and no document in
    `docs/playtests/` has `status: stable` and `verdict: fun`, then the linter shall fail.
13. The linter shall accept documents of type `preprod` and `playtest`, and shall fail a playtest
    whose `verdict` is not `fun`, `not-yet` or `no`.

No spoilers:

14. Where the human asked to play or watch blind, the orchestrating agent shall approve the story and
    content stages itself, record that approval as delegated, and show the human only neutral
    artefacts: style frames without plot, statuses and stage names.

Integration:

15. Where a stable art direction exists, `/design` shall take its palette and tone as the brief for
    the interface and shall not contradict it.
16. The README and `AGENTS.md` shall mention the track only in text marked `<!-- track:preprod -->`.

## Security

No new entry point, data store, role or integration. The greybox is local and dependency-free;
moodboard references are links, so no third-party image is copied into the repository. Blind mode
changes who approves creative content, not access to anything.

## Open questions

- [x] Should the gate also require approved story and content design? No: the request names style
      frames and playtest; the order is enforced by `/onboard` and `/preprod`.

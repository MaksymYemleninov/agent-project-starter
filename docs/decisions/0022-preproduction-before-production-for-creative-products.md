---
type: adr
id: "0022"
status: accepted
date: 2026-11-21
deciders: [maintainers]
tags: [process, onboarding, games, creative]
supersedes: null
superseded_by: null
---
# 0022 - Run preproduction before production code for games and creative products

## Context

`/onboard` goes from product documents (phase 3) to a stack (phase 4) to a skeleton (phase 6) and
the first spec. For a service or a tool that order is right: what the product does is settled by the
product documents, and the code proves the toolchain.

It was wrong for the first game built from this template, a couch co-op browser game. Onboarding
went straight from product documents and stack ADRs to a scaffold and a playable MVP. The story, the
characters, the art direction and any check that the core loop was fun came after code existed. The
art and the tone then had to be redone: the look read as too childish for the intended players, and
the story arrived after the engine had already decided what a level was. Nothing in the pipeline
asked who the players were by age, what the humour was, or whether moving and jumping was fun with
grey boxes, before a production stack existed to build around the answers.

For a game, a film-like experience, an interactive story or anything else whose look, tone and feel
are the product, three things decide most of what follows and are cheap to change only before
production: the concept and its audience, the world and its characters, and whether the core loop is
fun. Game studios separate this as preproduction for that reason. The template already has the
pattern this needs: an optional track (`.claude/tracks.json`, [ADR 0015](0015-share-template-track-ownership.md))
that onboarding keeps or drops, text marked with the track ([ADR 0021](0021-mark-optional-track-text-and-cut-it-with-the-track.md)),
and a lint gate that refuses to approve a spec before an upstream artefact is approved, as `ui: true`
does for the design system ([ADR 0014](0014-design-before-frontend.md)).

Constraints:

- `/assess` already decides whether to build at all, and `/design` already makes the interface's
  tokens and prototypes. Preproduction must feed both and duplicate neither.
- A greybox prototype is code, and onboarding says no code before phase 6 and no dependency without
  an ADR. The prototype has to be throwaway by construction, not by promise.
- The owner sometimes wants to play the game blind. Then the person who approves everything cannot
  read the story, and the approvals that need the story have to be made by someone else.
- Approvals that happen only in chat are lost with the session, so each one is a status in a file.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave it to the human to run things in the right order | Nothing to build | That is what happened, and the template led the other way | Low |
| More questions in onboarding phase 2 (audience, tone) | Small | Answers in chat, no art approval, no fun check; code still comes first | Low |
| Extend `/design` to cover story and art | One command | Mixes interface tokens with world and story; `/design` runs after the stack, too late; non-game UI projects pay for it | Medium |
| An optional preproduction track: `/preprod` with five approved stages before phase 4, a lint gate on specs that ship content, and a no-spoilers mode | Same shape as design and infra; mechanical gate; dropped cleanly for other projects | A long stage before any production code; a new spec field and two document types | Low |

## Decision

We will add an optional `preprod` track: a `/preprod` command and a `preproduction` skill that run,
in order and before onboarding phase 4, concept and tone, story and world, art direction with style
frames the human chooses, a throwaway greybox of the core loop with a recorded playtest the human
approves, and content design; specs that ship production content carry `content: true`, and the
linter refuses to approve one until the art direction is approved and an approved playtest says the
loop is fun; in blind mode the orchestrating agent approves story and content and the human sees only
neutral artefacts; onboarding drops the track for projects that are not games or creative products.

## Consequences

### Positive

- The production stack is chosen for a game whose audience, tone, look and core loop are already
  approved, so the engine fits the game instead of the other way round.
- Fun is checked when it is cheapest to fix: with grey boxes, before art and code exist to defend.
- The look is chosen by the human from concrete style frames, not discovered after the art is made.
- The idea bank keeps every rejected idea, so a cut idea can return without being reinvented.
- `/design` gets a real brief for a game's interface (HUD, menus) from the approved art direction.

### Negative

- Weeks of preproduction can pass before production code. For a game jam or a toy that is friction;
  the stages can be short, but none is skipped.
- The greybox is code outside the production tree. It is kept out of `sourcePaths` and never
  imported, which also means no gate checks it; it is thrown away by convention plus review.
- The gate checks that the art direction and a playtest are approved, not that production follows
  them. Fidelity to the style frames is review.
- Like every documentation gate it only reports while the project is in `exploration`, which is
  exactly when the first content specs are written. Until `/harden` the order rests on `/onboard`
  holding phase 4 for all five stages, and on the agent.
- A playtest by bots or a simulation is useful for load and bottlenecks but cannot open production:
  only `players: people` with `verdict: fun` does.
- Blind mode moves approvals for story and content from the human to the agent. A bad story can pass
  a self-review the human never sees; the human can end blind mode at any time to read it.
- Style frames made by an agent without an image model are HTML or SVG compositions. They show
  palette, shape language and mood, not finished illustration.
- Two new document types (`preprod`, `playtest`) and one spec field are more to learn.

## Revisit when

The first game onboarded with this track reaches its first production spec. If the art or the tone
still had to be redone, the stages are in the wrong order or the approvals are too easy to give, and
this record should be superseded by one that says which.

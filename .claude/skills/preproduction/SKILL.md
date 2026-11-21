---
name: preproduction
description: How a game or creative product is preproduced before any production code - concept and tone (audience age, genre, references, humour), story and world (goal, characters, visual bible, idea bank), art direction (moodboard, style frames chosen by the human), a throwaway greybox of the core loop with a recorded playtest, and content design - plus the content gate on specs and the no-spoilers rule for a human who plays blind. Use when /preprod or /onboard runs it, before approving a spec with content: true, and when the look, story or tone of such a project changes.
---

# Preproduction

For a game or a creative product, the look, the tone and whether it is fun are the product. They
are cheap to change before production and expensive after, so they are decided first, in order, and
each is approved in a file before the next starts. The production stack, the scaffold and the first feature come after.

| # | Stage | Documents | Artefacts | Approved by |
|---|---|---|---|---|
| 1 | Concept and tone | `docs/preprod/concept.md` | - | human |
| 2 | Story and world | `docs/preprod/story.md`, `docs/preprod/idea-bank.md` | - | human, or agent in blind mode |
| 3 | Art direction | `docs/preprod/art-direction.md` | `preprod/moodboard.md`, `preprod/style-frames/` | human |
| 4 | Greybox and playtest | `docs/playtests/NNNN-slug.md` | `preprod/greybox/` | human, who plays it |
| 5 | Content design | `docs/preprod/content.md` | - | human, or agent in blind mode |

Formats are in [formats.md](formats.md). `status: stable` means approved; nothing else sets it.

## 1. The stages

**Concept and tone.** Ask, one question at a time, what the product documents do not answer:

- the audience with an age range and who else is in the room (a parent, a couch of friends). The age
  decides the tone, the humour, the difficulty and the art more than anything else, and "for
  everyone" is not an answer: name the youngest and the oldest player it is made for;
- genre and the core verb (what the player does most, in one word), platform and play setting
  (couch co-op on one screen, phone on a commute);
- three to five references, each with what is taken from it and what is not. References are games,
  films, books, illustrators; name them, do not copy them;
- the tone of humour with one example line or situation it would contain and one it would never
  contain. "Funny" is not a tone; "deadpan slapstick, adults laugh at the timing, nobody is the butt
  of the joke" is;
- what it must never feel like. This is where "too childish" is caught before the art exists.

**Story and world.** The overall goal the player pursues from start to end, the characters with what
each wants, the villain and why they are right from where they stand, the locations in the order the
player meets them, and the visual bible: per hero, villain and location, a silhouette description,
palette, shape language and one distinctive detail. Every idea raised along the way goes into the
idea bank with its status (`in`, `parked`, `cut`) and the reason. Nothing is deleted from it: a cut
idea is the cheapest source of the next one.

**Art direction.** First a moodboard: links to references with a note on what each contributes
(palette, light, line, proportion). Links, not copied files: third-party images do not go into the
repository. Then two or three style frames of the same key scene from the story, each a different
direction within the concept, made as HTML, SVG or images in `preprod/style-frames/`, with the
palette and shape language written next to each. Check each against the concept's audience and
"never feel like" before showing it. The human opens them and picks one, possibly with changes; that
pick is the approval, recorded with the date and the frame. The rejected frames stay, with why.
If an image-generation tool is available and the human agrees to use it, frames may be generated;
say which tool made which frame.

**Greybox and playtest.** Build the core loop and nothing else: grey shapes, no art, no story, no
menus beyond what starts it. It answers one question, "is the loop fun without the art?". Rules:

- it lives in `preprod/greybox/`, outside `sourcePaths`, and production code never imports it;
- no dependency that no ADR covers: one self-contained HTML file with a canvas, or a paper
  prototype, is usually enough. If the loop truly needs an engine to be judged, that is a stack
  decision and goes to the human first;
- it is throwaway. Production rebuilds the loop on the approved stack; the playtest, not the code,
  is what carries over.

Then the human plays it, and you record a playtest in `docs/playtests/`: who played, how long, what
they did, where they laughed, got stuck or stopped, the tuning tried, and a verdict: `fun`,
`not-yet` (change and play again, as a new playtest) or `no` (the loop is wrong; go back to the
concept). Write what was observed, not what was hoped. The human approves the verdict; only then
is it `stable`.

**Content design.** Per level, mission or episode: its goal, which mechanic it teaches or tests,
where it sits in the story, the location from the visual bible, and the beat that should land.
Everything here is built from the approved loop and set in the approved world; a new mechanic is a
new greybox and playtest first.

## 2. The gate

A spec that ships production content sets `content: true` in its frontmatter: art, characters,
story, levels, or gameplay built on the core loop. The linter refuses `approved`, `in-progress` or
`done` for it while `docs/preprod/art-direction.md` is not `stable`, or while no playtest in
`docs/playtests/` is `stable` with `verdict: fun`. Engine plumbing that ships no content (input,
saving, a build pipeline) is `content: false`, but it is still built after preproduction.

A content spec names the style frame and the content entry it implements, the way a UI spec names
its prototype.

## 3. How production uses it

- The art direction's chosen frame and palette are the reference for every asset. A difference is
  either fixed or recorded in `art-direction.md` as a dated decision with the reason.
- If the project has a UI (menus, HUD), the interface's design system takes its palette and tone
  from the art direction and does not contradict it.
- A new mechanic goes through a greybox and a playtest before a content spec uses it.
- The idea bank is read before inventing: a parked idea may fit.

## 4. No spoilers (blind mode)

When the human wants to play or watch the result without knowing it, record `blind: true` in
`concept.md`. From then on:

- **You approve story and content.** The orchestrating agent, the session running `/preprod`,
  approves `story.md`, `idea-bank.md` and `content.md` after checking them against the approved
  concept: audience and age, tone, references, "never feel like". Record each approval as
  `approved by agent (delegated, blind mode)` with the date. If a fresh-context subagent is used for
  a second read, give it the files, not your conclusion.
- **The human sees only neutral artefacts**: the concept they approved, style frames that show a
  scene's look but not what happens in it (no plot text, no character names that reveal a role, no
  twist in a caption), the greybox, which has no story, and statuses: stage names, `draft` or
  `stable`, dates, counts ("eight levels designed").
- **Never in chat**: plot, character arcs, twists, endings, level contents, idea-bank entries,
  quotes from spoiler documents. This holds in summaries, commit messages, pull request
  descriptions and reports too. Spoiler documents carry `spoilers: true` in their frontmatter and a
  first line saying so, so the human knows not to open them.
- **Questions that need the human** are asked without the spoiler: "the second act needs a tone
  check: closer to frame A's mood or frame B's?", not the scene itself.
- The human can end blind mode at any time by saying so; record it in `concept.md`.

## 5. Changing it

Concept and art direction are allowed to change; they are not allowed to drift. A change goes
through `/preprod revise <stage>`: the document returns to `draft`, the human (or, in blind mode for
story and content, you) approves again, and a dated decision line records it. A change that
invalidates an approved style frame or playtest reopens it. A new direction for the whole product
is an ADR.

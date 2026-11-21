---
description: Preproduction for a game or creative product - concept and tone, story and world, art direction, greybox playtest, content design - approved stage by stage before any production code.
argument-hint: "[status | concept | story | art | greybox | content | revise <stage>] (default: next unfinished stage)"
---

# Preproduction

Stage: **$ARGUMENTS** (the next unfinished stage if empty; `status` prints where it stands).

For a game, an interactive story or any product whose look, tone and feel are the product, decide
what it is, who it is for, what it looks like and whether it is fun before a production stack
exists. `/onboard` runs this between phase 3 and phase 4 and does not start phase 4 until the art
direction and a fun playtest are approved; it can also be run on its own. A spec with
`content: true` cannot be approved before them either: the linter refuses it.

Read `.claude/skills/preproduction/SKILL.md` first, and `formats.md` next to it for every document
you write. Then read what already exists in `docs/preprod/` and `docs/playtests/`: each stage ends
in a status, and a stage that is `stable` is not redone unless the human asks for `revise`.

## Before the first stage

Ask, one question at a time, unless `docs/preprod/concept.md` already answers it:

1. Will the human play or watch it blind? If yes, run in blind mode (the skill's section 4) from
   here on, and record it in `concept.md`. Ask this first: every later answer depends on it.
2. Who approves each stage. By default the human approves all five; in blind mode the human approves
   concept, art direction and playtest, and story and content are approved by you.

## Stages

Run them in order. Each one: draft, show the human what they may see, revise, get the approval in
the conversation, set `status: stable` with a dated approval line, add the document to
`docs/INDEX.md`, update `.claude/onboarding.json` if onboarding is in progress, commit.

1. **Concept and tone** → `docs/preprod/concept.md`. Audience with an age range, genre, platform and
   play setting, three to five references and what is taken from each, the tone of humour with an
   example line, and what it must never feel like.
2. **Story and world** → `docs/preprod/story.md` and `docs/preprod/idea-bank.md`. The overall goal,
   the characters, the visual bible (heroes, villain, locations, palette) and the idea bank, which
   keeps every idea, including the rejected ones.
3. **Art direction** → `docs/preprod/art-direction.md`, `preprod/moodboard.md`,
   `preprod/style-frames/`. A moodboard of linked references, then two or three style frames of one
   key scene. The human picks one; that pick is the approval.
4. **Greybox and playtest** → `preprod/greybox/`, `docs/playtests/NNNN-slug.md`. The core loop with
   grey shapes and no art, the human plays it, the playtest records what happened and a verdict.
   Only `verdict: fun` with `status: stable` lets production start.
5. **Content design** → `docs/preprod/content.md`. Levels, missions or episodes, each built from the
   approved loop and set in the approved world.

## After the last stage

Say what is approved, by whom and when, without spoilers in blind mode. If `/onboard` is in
progress, return to its phase 4: the stack is now chosen for this game.

<!-- track:design -->
If the project has a UI (menus, HUD), `/design` comes next for the interface and takes its brief
from the art direction.
<!-- /track:design -->

## Revise

`revise <stage>`: say what changes and why, update the document, set it back to `draft` until it is
approved again, and add a dated line. A change to concept or art direction after production started
reopens the playtest or the style frames it invalidates; say which.

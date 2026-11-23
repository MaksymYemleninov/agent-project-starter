---
type: plan
spec: "0008"
status: done
date: 2026-11-21
---
# 0008 - Implementation plan

## Approach

Follow the design track. One command, `/preprod`, is the entry point and is short; the procedure,
document formats and the no-spoilers rule live in the `preproduction` skill (`SKILL.md` and
`formats.md`). Documents go to `docs/preprod/` (`concept.md`, `story.md`, `idea-bank.md`,
`art-direction.md`, `content.md`) and `docs/playtests/NNNN-slug.md`; artefacts go to `preprod/`
(`moodboard.md` links, `style-frames/`, `greybox/`) at the repository root, outside `sourcePaths`.

`/onboard` gains a question in phase 2 (is it a game or creative product, will the human play it
blind) and a phase between 3 and 4 that runs `/preprod` and holds phase 4 until the art direction
and a fun playtest are approved. The phase is named "Phase 3a" so the numbered phases keep their
numbers. `/onboard` is exempt from markers, as it names every track by design.

The linter gets a `content: true` gate next to the `ui: true` one, and accepts `type: preprod` and
`type: playtest` with a `verdict` check. `/design` reads the art direction when it exists, `/assess`
points at the greybox as the cheapest fun experiment, `/harden` requires the approvals, and
`AGENTS.md`, the README and `docs/INDEX.md` mention the track in marked text.

## Test strategy

`test-gates.mjs`: a `content: true` spec fails without an art direction, fails with a draft one,
fails without a fun playtest, fails with a playtest verdict outside the set, and passes once both are
approved. `test-regressions.mjs`: disabling `preprod` leaves no mention and keeps the others' text.
`test-derived.mjs` already disables every optional track; it asserts the preprod text is gone. A
regression test holds phase 3a between phases 3 and 4 and the phase 4 hold naming all five
documents. The gate test sets aside a derived project's own preproduction documents, so it also
passes in a game project.

## Review and first run

A clean-context review found the phase 4 hold checked two stages of five; fixed. The first real game
run (2026-11-21) added [PROPOSED: feedback from that run]: bots playtests that cannot open production,
a metrics section, style frames never in `docs/design/`, a local server for frames, real people as
characters, product-level ADRs allowed in phase 3a, batch approval, and blind mode for content specs.

## Risks

- The `AGENTS.md` budget: one marked row only.
- The skill name `preproduction` must not collide with ordinary words in other files.

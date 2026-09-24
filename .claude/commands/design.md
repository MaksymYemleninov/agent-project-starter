---
description: Create or revise the design system before frontend work - direction, tokens, component inventory and working HTML prototypes, approved by the human in a browser.
argument-hint: "[create | revise <what> | light] (default: create)"
---

# Design

Mode: **$ARGUMENTS** (create if empty).

Run this after onboarding and before the first UI spec is approved: the linter will not approve a
spec with `ui: true` until `docs/design/system.md` is `stable`. It uses two skills, and both are
read first:

- `frontend-design` (the Anthropic plugin skill, enabled for this project): the aesthetic method.
  Follow it: ground the design in the subject, plan tokens and layout, review the plan against the
  generic defaults it lists, only then build, then critique.
- `.claude/skills/design-system/SKILL.md`: where everything goes, the token structure and the
  quality floor.

If the `frontend-design` skill is not available (the plugin is not installed or the folder is not
trusted), say so and stop. Designing without it produces exactly the templated look it exists to
avoid.

## Create

1. **Brief.** From `docs/product/vision.md`, `personas.md`, `scope.md` and the first capability in
   scope, write the brief: who, in what situation, what they must get done and feel, and the
   subject's world. Show it to the human in five lines and ask the one or two questions it cannot
   answer (an existing brand, a product the human wants it to feel like or unlike, light or dark
   first). One question at a time.
2. **Direction, as a plan, before any code.** Per the frontend-design skill: 4 to 6 named colours,
   typefaces and their roles, a layout concept with ASCII wireframes for the key screens, and the
   principles. Then review it against the listed defaults and say what you changed and why. Present
   the plan and wait for the human's reaction. Offer two directions only when the brief genuinely
   leaves the choice open.
3. **Tokens.** Write `design/tokens.css` with the three layers from the design-system skill, light
   and dark themes, and compute the contrast of every text and UI pairing. Fix any pairing below the
   floor before going on, and put the ratios in `system.md`.
4. **Prototypes.** Two or three key screens from the first capability as self-contained HTML in
   `design/prototypes/`, importing `../tokens.css`, with real content from the scope, not lorem
   ipsum. Include the empty, loading and error states, and make each work at 375 px and at desktop
   width.
5. **Critique with your own eyes.** Open each prototype in a browser if one is available (the
   Browser pane, or Playwright), capture desktop and mobile, and review against the brief, the
   principles and the quality floor. Fix, then capture again. Say what you changed.
6. **Human review.** Give the human the paths to open. Collect feedback, revise, repeat. The design
   is approved only when they say so in the conversation.
7. **Record.** Write `docs/design/system.md` per `system-format.md` with `status: stable`, a dated
   decision line naming the approval, and the component inventory the prototypes imply. Add it to
   `docs/INDEX.md` under Design and a `docs/log.md` entry. If the project uses a framework theme
   (Tailwind, a component library), generate its configuration from the tokens now, so code starts
   from the same values.

Figma is optional: if the human wants the design in Figma and the Figma connector is authorised,
push the approved prototypes there after step 6. The repository stays the source of truth.

## Light

For an internal tool or a first version where one screen carries the product: steps 1 to 7 with a
single prototype and the smallest token set that covers it. The quality floor does not get lighter.

## Revise

For a change to the design: state what changes and why, update tokens or principles, re-render the
affected prototypes, show before and after, get approval, and add the decision line. If the change
is a new direction for the whole product, it is an ADR as well.

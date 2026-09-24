---
name: design-system
description: How this project's visual design is made, recorded and enforced - the /design process, the artifacts (principles, tokens, component inventory, HTML prototypes), the quality floor (accessibility, states, responsiveness), and how frontend code must use them. Use before any UI work, when building or reviewing components, and when the design needs to change. The aesthetic direction itself comes from the frontend-design plugin skill.
---

# Design system

The frontend is built to a design the human approved, not improvised screen by screen. Before the
first UI spec is approved, `/design` produces a small design system and working prototypes; from
then on, UI code uses only its tokens and components, and `design-reviewer` checks the result
against it.

Two skills, two jobs. The **`frontend-design`** plugin skill (Anthropic's, enabled in
`.claude/settings.json`) supplies taste: a distinctive direction for this product, typography,
avoiding the defaults that make generated interfaces look alike. **This skill** supplies the
process and the contract: where the design lives, what it must contain, what quality floor it
meets, and how code is held to it.

## 1. Artifacts

| Path | What | Status field |
|---|---|---|
| `docs/design/system.md` | direction and principles, token rationale, component inventory, decisions | `status: draft` until the human approves, then `stable` |
| `design/tokens.css` | the tokens as CSS custom properties: the one source the code imports | - |
| `design/prototypes/*.html` | 2 to 3 key screens as self-contained HTML using the tokens, with real content | - |
| `design/screenshots/` | optional: captures used in review, desktop and mobile | - |

`docs/design/system.md` follows [system-format.md](system-format.md). The tokens are the contract:
if a value is not a token, code does not use it.

## 2. Token structure

Three layers, so a change of brand touches one of them:

1. **Primitives**: the raw palette and scales (`--color-teal-600`, `--space-4`, `--font-size-3`).
   Never used by components directly.
2. **Semantic**: meaning, per theme (`--color-bg`, `--color-text`, `--color-text-muted`,
   `--color-accent`, `--color-danger`, `--color-border`, `--color-focus`). Light and dark themes
   redefine these, and only these.
3. **Component**: only where a component needs its own knob (`--button-radius`). Rare.

Cover: colour (semantic set for both themes), type (families, a modular scale, weights, line
heights), space (one scale), radius, shadow or elevation, motion (durations, easing, and a reduced
motion rule), breakpoints, z-index layers. If a framework is used (Tailwind, a component library),
it is configured from these tokens, not the other way round.

## 3. Quality floor

Every prototype and every screen meets this before it is approved or merged. It is the floor,
checked every time, not the goal.

- **Contrast** (WCAG 2.2 AA): at least 4.5:1 for body text, 3:1 for large text and for UI
  components and focus indicators against what they sit on. Checked for both themes, from the
  semantic tokens.
- **Keyboard**: everything interactive is reachable and operable by keyboard, in a sensible order,
  with a clearly visible focus style that is its own token.
- **Targets**: interactive targets at least 24 by 24 CSS pixels (WCAG 2.2 AA), 44 for primary touch
  actions.
- **Motion**: `prefers-reduced-motion` respected; no essential information carried by motion alone.
- **Responsive**: works from 320 px wide up, with no horizontal scroll and no text below the
  smallest body size.
- **States**: every data-driven view designs its loading, empty, error and partial states, and
  every control its hover, focus, active, disabled and invalid states. An undesigned state is where
  generated UIs look broken.
- **Semantics**: real headings in order, labels on inputs, buttons for actions and links for
  navigation, alt text that says what the image is for.
- **Copy**: plain words in the user's language, sentence case, actions named by what they do, errors
  that say what happened and how to fix it (the frontend-design skill's writing section).

## 4. How code uses it

- Components import `design/tokens.css` (or the framework theme generated from it) and use semantic
  tokens only. A hardcoded colour, font size, spacing value or shadow in a component is a finding.
  Enforce it with the stack's linter where possible (for CSS, stylelint `color-no-hex` and
  `declaration-property-value-disallowed-list`; for Tailwind, no arbitrary values).
- Primitive components live in one place (`components/ui/` in the Next.js pack) and match the
  inventory in `docs/design/system.md`. A new primitive is added to the inventory in the same change.
- A screen is built from its prototype. Differences are either fixed or recorded in `system.md` as
  a decision with the reason.
- UI specs set `ui: true` in their frontmatter and link the prototype they implement. The linter
  refuses to approve a UI spec while the design system is not approved.

## 5. Changing the design

The design is allowed to change; it is not allowed to drift. A change to tokens or principles goes
through `/design` again in "revise" mode: the human sees the before and after, approves, and the
change lands in `system.md`'s decisions. A new direction for the whole product is an ADR.

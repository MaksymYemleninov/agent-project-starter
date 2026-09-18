---
name: design-system
description: Frontend and visual conventions for this project. Use when building or changing any UI. PLACEHOLDER until /onboard fills it from the chosen stack.
---

# Design system

> **Placeholder.** `/onboard` fills this from the UI decisions it records, or deletes this skill
> if the project has no UI. An empty skill that survives onboarding is worse than no skill: it
> costs context and teaches nothing.

Fill in only what is true for this project. Delete every heading you cannot answer concretely.

## Tokens

Colors, spacing scale, type scale, radii, shadows. Where they are defined, and the rule that no
component hardcodes a value that exists as a token.

## Components

Where components live, what a new one must have (states, keyboard behavior, loading, empty,
error), and when to extend an existing one instead of adding a sibling.

## Layout

Breakpoints, container widths, the grid. What must not break at 320px.

## Accessibility floor

The non-negotiable minimum, checked before any UI change ships:

- contrast at least 4.5:1 for body text, 3:1 for large text and interactive boundaries,
- every interactive element reachable and operable by keyboard, with a visible focus state,
- touch targets at least 44 by 44 CSS pixels,
- images have alt text, decorative ones have empty alt,
- form fields have real labels, not placeholder text doing the job of one,
- state is never communicated by color alone.

This list stays even if the rest of the file is rewritten.

## States

Every screen needs loading, empty, error and success defined before it is built. Most UI bugs
that reach users are missing states, not wrong logic.

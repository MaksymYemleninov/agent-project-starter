---
type: adr
id: "0014"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, design, frontend]
supersedes: null
superseded_by: null
---
# 0014 - Approve a design system before frontend work, and hold code to its tokens

## Context

The template had a `design-system` skill that was a placeholder, and nothing in the pipeline asked
for a design before UI code was written. An agent building a frontend without one improvises each
screen: colours and spacing chosen per component, states forgotten (empty, loading, error are where
generated interfaces look broken), and an overall look that converges on the same few defaults
every generated interface shares. Fixing that after twenty screens is a rewrite.

The owner wanted Claude's design ability used deliberately: a step before frontend work where the
design is made, approved, and then followed. Anthropic publishes a `frontend-design` skill,
available as a plugin in the official marketplace under Apache 2.0, that addresses the aesthetic
half directly: it grounds the design in the product's subject, plans tokens and layout before code,
reviews the plan against a list of generic defaults, and critiques the result from screenshots. It
was read at its source before relying on it. What it does not do is decide where a design lives,
what a project must have before building UI, or how code is kept to it. That is the half this
template has to supply.

Two constraints. An approval that happens only in chat is lost with the session, so the approved
design has to be files in the repository. And "follow the design" is a prose rule unless something
checks it: the linter for the gate, the stack linter for hardcoded values, and a reviewer for what
tools cannot see.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave design to each UI spec | No new stage | Improvised per screen; no shared tokens; the templated look by default | Low |
| Copy the frontend-design skill into the template | Works without the plugin | A fork that ages; the original is maintained by its authors | Low |
| Plugin for taste, template for process: `/design` produces tokens, prototypes and a system document, a linter gate blocks UI specs until it is approved, a design reviewer checks code against it | Uses the maintained skill; the design is files; the gate is mechanical | One more stage before the first UI feature; depends on the plugin being installed | Low |
| Design in Figma as the source of truth | Familiar to designers | Not readable by the agents building the UI without a connector; drifts from code | Medium |

## Decision

We will enable the `frontend-design` plugin for projects with a UI and add a design track:
`/design` (create, light, revise) produces `docs/design/system.md`, `design/tokens.css` and HTML
prototypes that the human approves in a browser; specs carry `ui: true` and the linter refuses to
approve one until the design system is `stable`; components use semantic tokens only, enforced by
the stack linter where possible; `design-reviewer` checks tokens, states, the accessibility floor
and fidelity in `/ship`; `/harden` requires all of it; and onboarding deletes the track for
projects without a UI.

## Consequences

### Positive

- The first UI feature starts from an approved direction, tokens and prototypes instead of a blank
  page, and every later screen starts from the same ones.
- The accessibility floor (contrast, keyboard, targets, motion, states) is checked at design time,
  when it is cheapest, and again in review and in end-to-end tests.
- A change of look is a token change reviewed once, not a hunt through components.

### Negative

- A stage now stands between onboarding and the first UI feature. For a throwaway prototype that is
  friction; `/design light` shortens it but does not remove it.
- The design depends on the plugin being installed and the folder trusted. Without it `/design`
  stops, by design, which blocks UI specs until someone fixes the setup.
- The gate checks that a design is approved, not that the code follows it. Fidelity is the
  reviewer's judgement, and a reviewer without a running app can only read code.
- HTML prototypes are not a designer's tool. A team with a designer working in Figma has to decide
  which is the source of truth; this record says the repository.
- The quality floor quotes WCAG 2.2 AA thresholds; if the standard moves, this template is wrong
  until someone updates it.

## Revisit when

The first real `/design` run is reviewed by a human with design judgement. If the output still
reads as templated, the fault is in the process here, not only in the plugin, and the brief or the
critique step needs strengthening.

---
type: adr
id: "0018"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, code-quality]
supersedes: "0017"
superseded_by: null
---
# 0018 - Keep the NestJS and Nuxt pack independent of CleanSlice

## Context

[ADR 0017](0017-nestjs-nuxt-pack-on-cleanslice.md) added a `nestjs-nuxt` pack built on CleanSlice
(<https://cleanslice.org>). Three parts of it depended on CleanSlice acting:

- the boundary check was CleanSlice's `cleanslice-check.cjs`, which their docs describe but do not
  publish, with "ask them for it" as the fallback;
- the CleanSlice MCP server was added to every project on this stack, although it serves unpinned
  docs, pushes its own workflow through `get-started`, and receives the agent's queries;
- the follow-ups asked CleanSlice to publish the script, version the docs and fix pages that
  contradict each other.

The owner does not expect CleanSlice to change or publish any of it, and asked for the template
to decide for itself or drop those parts. Meanwhile the TypeScript pack gained parameterized
dependency-cruiser rules (cycles, feature entry points, feature order, layers, a barrel name check)
that can express CleanSlice's three checks with this layout's values.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep 0017 and wait for CleanSlice | No new work | The boundary check does not exist until they act; MCP drift and process instructions arrive by default | Low |
| Drop the pack | Nothing to maintain | Loses the stack the owner wants projects to be able to pick | Low |
| Keep the pack, own the check with the TypeScript pack's rules, make the MCP opt-in, freeze the CleanSlice docs it was written from | Works today; one boundary mechanism across TypeScript packs; no third-party text by default | The pack no longer follows CleanSlice's changes automatically; frontend boundaries stay review-only | Low |

## Decision

We will keep the `nestjs-nuxt` pack self-contained, with boundary rules from the TypeScript pack,
the CleanSlice MCP as an opt-in, and CleanSlice's docs at commit `42380cc` as its frozen source.

## Consequences

### Positive

- A project on this stack gets a working boundary check at onboarding, built the same way as the
  other TypeScript packs, and "Prisma only in `data/`" becomes a checked rule.
- No third-party text reaches the agent unless the human asks for it.
- Nothing in the pack waits on another company.

### Negative

- The pack drifts from CleanSlice as CleanSlice changes. Following them is now a deliberate pack
  update, not automatic.
- The rules have to be written at onboarding from the pack's parameters rather than copied as a
  finished script; the first project on this stack is the first real test of them.
- `app/` has no boundary check: Nuxt auto-imports hide most dependencies, so frontend boundaries
  are review-only by decision.
- A project that says yes to the MCP still takes on unpinned docs and outbound queries, with the
  controls in the pack.

### Follow-ups

- None towards CleanSlice.
- When the first project on this stack reaches `/harden`, check the rules against its code and
  fix the pack.

## Revisit when

A project on this stack finds the boundary rules miss a real violation, CleanSlice changes its
layering enough that the pack no longer matches projects started from their docs, or a project
needs only one half of the pack.

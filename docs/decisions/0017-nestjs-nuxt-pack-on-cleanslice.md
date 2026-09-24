---
type: adr
id: "0017"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, code-quality]
supersedes: null
superseded_by: null
---
# 0017 - Add a NestJS and Nuxt stack pack built on CleanSlice

## Context

[ADR 0013](0013-engineering-rulebook-with-stack-packs.md) shipped packs for the stacks the owner's
projects used: TypeScript, Next.js, Python and Go. Most new projects start from nothing, and the
stack is chosen at onboarding. A pack that already exists makes its stack cheaper to pick, and
onboarding can check whether it fits the project instead of writing rules from scratch.

CleanSlice (<https://cleanslice.org>), from partner company Dreamvention, is a published
architecture for NestJS + Nuxt + Prisma + Tailwind. It has about fifty documents covering slices,
layers, patterns and setup, an MCP server that serves them (<https://github.com/CleanSlice/mcp>),
and a boundary check on dependency-cruiser that its authors run on their own projects. Its layering
matches section 1 of the rulebook (structure by feature, dependencies inward). Two parts of it
conflict with this template:

- Its `get-started` document tells the agent to follow its own four-phase approval workflow,
  treats the stack as fixed ("do not ask"), and says to consult the MCP before any plan. Its README
  enforces that with a `CLAUDE.md` rule and a Stop hook that has an LLM check the transcript for
  MCP calls, and refuses to stop until they happened.
- Its concrete gateway may hold business logic next to Prisma queries, while section 1 says the
  domain has no I/O.

The hosted MCP server reads CleanSlice's docs from `main`, so what it returns can change without
notice.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| No pack until a project on this stack exists | Nothing to maintain | Onboarding for this stack starts from nothing; the stack is less likely to be picked even when it fits | Low |
| Adopt CleanSlice wholesale, including its workflow, MCP rule and Stop hook | Closest to the partner's intent | Two competing processes; an LLM hook that can block forever; a process check instead of a result check | Medium |
| A pack that takes CleanSlice's structure, patterns, docs and boundary check, with this template's process and principles on top and the conflicts resolved in the pack | Concrete rules and a tested check from day one; one process | A fifth pack to keep current; depends on a third party's docs staying available | Low |

## Decision

We will add `engineering-rulebook/nestjs-nuxt.md` as a stack pack and track. It takes CleanSlice's
structure, naming, patterns and `cleanslice-check.cjs`, and adds the CleanSlice MCP server to the
project's `.mcp.json` as reference material. The template's process and section 1 principles
outrank CleanSlice, and the pack names each conflict and how it is resolved.

## Consequences

### Positive

- A project on this stack gets concrete rules, a boundary check that already has a history, and
  searchable pattern docs at onboarding.
- The conflicts are written down once, in the pack, instead of rediscovered per project.

### Negative

- Five packs to keep current. CleanSlice moves on its own schedule, and the pack can drift from it.
- The hosted MCP server serves unpinned docs. A project either accepts that in its stack ADR or
  self-hosts from a pinned commit. Either way the server is an external text source in the
  agent's context and belongs in the threat model.
- The frontend has no boundary check from CleanSlice. Until a rule is added, `app/` boundaries are
  review-only.

### Follow-ups

- Report the conflicts in the pack back to CleanSlice, especially the process instructions in
  `get-started`, which clash with any host project's own workflow.
- When a project on this stack reaches `/harden`, check that the pack's rules held, and fix the
  pack.

## Revisit when

CleanSlice changes its layering or its boundary check, its MCP server offers versioned docs, or
two projects in a row on this stack override the same pack rule.

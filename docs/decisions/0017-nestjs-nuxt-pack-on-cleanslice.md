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
onboarding can check whether it fits the project instead of writing rules from scratch. The owner
asked for this pack on that basis.

CleanSlice (<https://cleanslice.org>), from partner company Dreamvention, is a published
architecture for NestJS + Nuxt + Prisma + Tailwind. It has about fifty documents covering slices,
layers, patterns and setup, and an MCP server that serves them (<https://github.com/CleanSlice/mcp>).
It also specifies a boundary check on dependency-cruiser that its authors run on their own
projects; the doc describes the script, but the script is not published there. Its layering
matches section 1 of the rulebook (structure by feature, dependencies inward).

What conflicts with this template:

- Its `get-started` document tells the agent to follow its own four-phase approval workflow,
  treats the stack as fixed ("do not ask"), and says to consult the MCP before any plan. Its README
  enforces that with a `CLAUDE.md` rule and a Stop hook that has an LLM check the transcript for
  MCP calls, and refuses to stop until they happened.
- Its pages disagree with each other. `service.md`, `controller.md` and the boundary check put
  business rules in a service and forbid a controller from reaching a gateway. The summary table
  in `nestjs-standards.md` lets the concrete gateway hold business logic next to Prisma queries,
  and has the controller inject the gateway. `new-project.md` shows flat slices, while the boundary
  check orders slices by group.
- Its API validation leaves `forbidNonWhitelisted` off, so unknown fields are dropped silently.
  `whitelist` already strips them; turning rejection on only helps when every client ships with
  the API, and breaks older or external clients otherwise.

The hosted MCP server answers from the docs of its last deploy, with no version pin.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| No pack until a project on this stack exists | Nothing to maintain | Onboarding for this stack starts from nothing; the stack is less likely to be picked even when it fits | Low |
| Adopt CleanSlice wholesale, including its workflow, MCP rule and Stop hook | Closest to the partner's intent | Two competing processes; an LLM hook that can block forever; a process check instead of a result check | Medium |
| One pack that takes CleanSlice's structure, patterns, docs and boundary check, with this template's process and principles on top and the conflicts resolved in the pack | Concrete rules and a specified check from day one; one process | A fifth pack to keep current; depends on a third party's docs staying available | Low |
| The same, split into separate `nestjs` and `nuxt` packs | Each half usable with another stack | CleanSlice is one architecture across both halves; the split would repeat the shared rules and invite mixes it does not describe | Low |

Within the chosen option, validation on the API follows CleanSlice (`class-validator`) rather than
the TypeScript pack's Zod, because Nest's pipes, DTOs and Swagger generation are built on it; the
app keeps zod through vee-validate, as CleanSlice's forms do. `forbidNonWhitelisted` is left to
each project's stack ADR, by who its clients are.

Where structure and principle overlap, a precedence rule of thumb ("CleanSlice for structure,
template for principles") does not decide anything: business logic placement is both. So the
pack lists its resolutions explicitly, CleanSlice decides only placement, naming and its named
patterns outside that list, and anything touching dependency direction, domain I/O or edge parsing
goes to the principle. The abstract gateway and mapper per entity are named as a deliberate
exception to "Simple first".

## Decision

We will add one `nestjs-nuxt` stack pack that follows CleanSlice for structure, patterns and the
boundary check, and this template for process and principles.

## Consequences

### Positive

- A project on this stack gets concrete rules, the specification of a boundary check (the script
  itself still has to be obtained or written) and searchable pattern docs at onboarding.
- The conflicts, including the ones inside CleanSlice's own docs, are written down once, in the
  pack, instead of rediscovered per project.
- The pack requires the TypeScript track, and the adapter refuses to remove one without the other.

### Negative

- Five packs to keep current. CleanSlice moves on its own schedule, and the pack can drift from it.
- The boundary check script has to be obtained from CleanSlice or written from its spec.
- Two validators and MCP examples tuned to CleanSlice's settings, not the project's: the agent and
  reviewer have to know which one a file follows.
- The hosted MCP server serves unpinned docs and receives the agent's queries. A project either
  accepts that in its stack ADR or self-hosts from a pinned commit, and records the server in its
  threat model.
- The frontend has no boundary check from CleanSlice. Until a rule is added, `app/` boundaries are
  review-only.

### Follow-ups

- Report the conflicts back to CleanSlice: the process instructions in `get-started`, which clash
  with any host project's own workflow, and the pages that disagree with each other.
- Ask CleanSlice to publish `cleanslice-check.cjs`.
- When a project on this stack reaches `/harden`, check that the pack's rules held, and fix the
  pack.

## Revisit when

CleanSlice changes its layering or its boundary check, publishes the check script or versioned
docs, a project needs only one half of the pack (split out the other), or two projects in a row on
this stack override the same pack rule.

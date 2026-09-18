---
name: writing-adr
description: Write an architecture decision record. Use when a choice is expensive to reverse, crosses a component boundary, or will look arbitrary to someone who was not in the conversation. Also use when superseding an existing decision.
---

# Writing an ADR

## When not to write one

Start here, because the failure mode of this practice is volume, not absence. Do not write an ADR
for a naming choice, a formatting preference, a bug fix, or a decision that takes ten minutes to
undo. Every low-value record raises the cost of finding a high-value one.

The test, from `docs/decisions/0000-record-architecture-decisions.md`:

1. Expensive to reverse, **or**
2. crosses a boundary between components, **or**
3. will look arbitrary to a newcomer.

One of the three is enough. None of them means no ADR. Say that out loud rather than writing one
to be safe.

## Procedure

1. Next free number from `docs/decisions/`, zero-padded to four digits.
2. Copy `docs/decisions/_template.md` to `NNNN-kebab-imperative-title.md`.
3. Fill the frontmatter. `date` is today. `status` is `proposed` unless the human has already
   agreed in this conversation, then `accepted`.
4. Write the body in the order below. Context first, always. Writing Decision first produces a
   justification, not a record.

## Context: the section that does the work

This is the only part a future agent genuinely needs, and the only one that cannot be
reconstructed from the code. Write it so that a reader who was not there understands the
situation without asking anyone.

Include:

- the constraint that forced a choice (deadline, team size, existing system, cost, regulation),
- what already existed and could not be changed,
- what was tried before, if anything,
- what was unknown at the time. Recording uncertainty honestly is what stops a future reader from
  assuming the decision was better informed than it was.

Do not include: how good the chosen technology is. That belongs nowhere.

## Options considered

At least two, with the real advantages of the one you rejected. If an alternative reads as
obviously terrible, either you have not understood it or you are building a case rather than a
record. Include "do nothing" when it was plausible.

Give each option a cost-to-reverse estimate. That column is often the whole argument.

## Decision

Active voice, one sentence: "We will use X for Y." If it takes a paragraph, it is more than one
decision, and each gets its own record.

## Consequences

Positive, negative, follow-ups. The negative section is mandatory and it is not a formality: name
what becomes harder, what you are giving up, and what will hurt in a year. An ADR with no
downside is an advertisement.

Follow-ups are real work: the specs it creates, the documents it invalidates, the debt it
schedules. List them so they are visible.

## Superseding

Never edit a decision into a different decision, and never delete one. The wrong decision and the
reason it was made are the most useful things in the directory.

1. Write the new ADR with `supersedes: "NNNN"`.
2. On the old one, set `status: superseded` and `superseded_by: "MMMM"`.
3. Add a line at the top of the old body: `> Superseded by [MMMM - title](MMMM-title.md).`
4. Editing an existing ADR triggers a permission prompt by design. Get the human's agreement
   rather than trying to route around it.

`npm run lint:docs` verifies both directions of the link.

## Finishing

- Add the ADR to `docs/INDEX.md` under Decisions, with its status.
- If it changes the system's shape, update `docs/architecture/overview.md` in the same change and
  link the ADR from it.
- Run `npm run lint:docs`.

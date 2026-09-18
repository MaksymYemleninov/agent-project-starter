---
name: doc-maintenance
description: Keep the index, the log and document status honest. Use after any change that adds, retires or contradicts a document, and during periodic review.
---

# Documentation maintenance

The documents rot in three specific ways. Each has a fix.

## 1. The index goes stale

Every file under `docs/` must be reachable from `docs/INDEX.md`, directly or through a document
that is. `npm run lint:docs` fails otherwise, so this one is self-correcting, as long as you add
the index line in the **same change** as the document. Added later means never.

Specs are reached through their own `spec.md`, which links `plan.md` and `tasks.md`. Keep that
link in every spec.

## 2. The log becomes a second wiki

`docs/log.md` is a journal of operations, not a place to store knowledge. One entry per
meaningful change, 3 to 6 bullets, each answering "what changed and where" and linking to the
spec or ADR that holds the content.

Good:

> - Added `POST /accounts` with duplicate-email handling, per [spec 0003](specs/0003-signup/spec.md).
> - Chose Argon2id for password hashing, see [ADR 0007](decisions/0007-password-hashing.md).

Bad: a paragraph restating what Argon2id is. That belongs in the ADR, where someone will look
for it.

The one exception is something that cannot be lost and has no page of its own: a conflict between
sources, a gap in verification, the reason for a non-obvious workaround. Record those compactly
but completely.

## 3. Documents contradict each other

The dangerous failure. Two documents disagree, both look authoritative, and whichever the agent
reads first wins.

When you find a contradiction:

- **Do not silently overwrite.** The older statement may be the correct one.
- If it is an architectural claim, the resolution is a new ADR superseding the old one.
- If it is a product claim, ask the human which holds. Do not decide it yourself.
- Until it is resolved, write the conflict into the body of the more-read document in prose,
  naming both sides. An open conflict stated plainly is safer than a closed one decided wrongly.

## Status hygiene

| Status | Means | Gets stale when |
|---|---|---|
| `template` | never filled in | still there after `/onboard` |
| `draft` | being written | untouched for weeks |
| `stable` | verified, holds today | `last_verified` older than 180 days |
| `proposed` (ADR) | awaiting a decision | older than 14 days |
| `in-progress` (spec) | being built | nobody has touched it |

Update `last_verified` on substantive edits: facts, sections added or removed, sources changed.
Not on typos, formatting, or link renames. A `last_verified` bumped by a formatting pass is worse
than none, because it claims a verification that did not happen.

## Periodic review

Monthly, or after any large change:

1. `npm run lint:docs` and `npm run check:adr`.
2. Read the ADRs in order. Any conflicts? Any that reality has quietly superseded?
3. Compare `docs/architecture/overview.md` against the actual module layout.
4. Check whether the code has crossed anything in `docs/product/non-goals.md`.
5. Anything `in-progress` with no recent work: abandoned or blocked, both need a status change.

Report what you found. Fix mechanical problems directly; anything that changes meaning goes to
the human first.

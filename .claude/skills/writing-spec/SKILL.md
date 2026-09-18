---
name: writing-spec
description: Write a feature spec with acceptance criteria in EARS form, plus its plan and tasks. Use before implementing anything that spans more than one file.
---

# Writing a spec

A spec exists so an agent can implement a feature without guessing, and so a reviewer can tell
whether it did. If a criterion cannot be turned into a test without asking a question, it is not
finished.

## Order

`spec.md` (what and why) is approved **before** `plan.md` (how) is written, and `plan.md` before
`tasks.md`. Writing all three at once produces a plan that quietly redefines the problem to match
the solution you already had in mind.

## EARS

Every acceptance criterion uses one of five sentence patterns. This is not ceremony: the pattern
forces you to name the trigger or the state, which is exactly where ambiguity hides.

| Pattern | Shape | Use for |
|---|---|---|
| Ubiquitous | The system shall `<response>` | always-true properties |
| Event-driven | When `<trigger>`, the system shall `<response>` | reactions to something happening |
| State-driven | While `<state>`, the system shall `<response>` | behavior during a mode |
| Unwanted behavior | If `<condition>`, then the system shall `<response>` | errors, abuse, edge cases |
| Optional feature | Where `<feature is included>`, the system shall `<response>` | behavior behind a flag |

Good:

> When a user submits the signup form with an email that is already registered, the system shall
> return `409` and shall not create a second account.

Bad:

> The signup flow should handle duplicate emails gracefully.

"Gracefully" is where the bugs live. Name the status code, the message, and what must not happen.

Write the unwanted-behavior criteria deliberately. Most specs describe only the happy path, and
most production incidents live in the ones that were not written.

## Sections that earn their place

- **Problem** - from the user's side, no solution language. If the problem statement names your
  solution, you have skipped the problem.
- **Non-goals** - what this spec does not address. Stops the implementing agent from wandering.
- **Out of band** - what must be true outside the code: a DNS record, a vendor account, a
  migration, a flag. These are what actually delay delivery.
- **Open questions** - blocking unknowns. `status: approved` with unchecked open questions fails
  the linter, which is the point.

## Plan

Files touched with a risk rating, data changes, decisions that need an ADR **before**
implementation, test strategy, rollout and how to turn it off.

If the plan reveals a decision meeting the ADR test, stop and write the ADR first. Deciding
inside an implementation is how undocumented architecture happens.

## Tasks

Dependency-ordered. Each task small enough to finish and verify in one sitting, each with its own
done condition. "Implement the backend" is not a task. "Add `POST /accounts` returning 201 with
the created id, covered by a test asserting the duplicate-email 409" is.

Keep status current while working. A tasks file updated only at the end is a fiction written
afterwards.

## Finishing

- Spec, plan and tasks link to each other; the linter reaches plan and tasks through the spec.
- Add the spec to `docs/INDEX.md`.
- Run `npm run lint:docs`.

---
description: Record one architecture decision.
argument-hint: "<the decision, in a few words>"
---

# Record a decision

Decision to record: **$ARGUMENTS**

Follow `.claude/skills/writing-adr/SKILL.md`. Briefly:

1. **Apply the test first.** From `docs/decisions/0000-record-architecture-decisions.md`: is it
   expensive to reverse, does it cross a component boundary, or will it look arbitrary later? If
   none of the three holds, say so and do not write the ADR. Declining is a valid outcome.
2. Find the next free number: `!ls docs/decisions/ | tail -5`
3. Copy `docs/decisions/_template.md` to `docs/decisions/NNNN-kebab-title.md`.
4. Fill it. The Context section is the part that matters: write it for someone who arrives in a
   year with no memory of this conversation. Include the constraint that forced the choice.
5. Options considered must include the option you did not take, with its real advantages. If the
   alternatives are strawmen, the record is worthless.
6. Consequences must include negatives. Every real decision costs something.
7. Set `status: proposed` unless the human has already agreed, in which case `accepted`.
8. If this supersedes an existing ADR, set `supersedes` here, and set `status: superseded` plus
   `superseded_by` on the old one. Never delete or rewrite the old record. Ask before editing it.
9. Add it to `docs/INDEX.md` under Decisions.
10. Run `npm run lint:docs`.

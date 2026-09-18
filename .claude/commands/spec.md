---
description: Create a feature spec with EARS acceptance criteria, plan and tasks.
argument-hint: "<feature, in a few words>"
---

# Write a spec

Feature: **$ARGUMENTS**

Follow `.claude/skills/writing-spec/SKILL.md`.

1. Check it is in scope: read @docs/product/scope.md and @docs/product/non-goals.md. If it
   crosses a non-goal, stop and say so. That needs an ADR and the human's agreement, not a spec.
2. Next number: `!ls docs/specs/ | tail -5`
3. Create `docs/specs/NNNN-kebab-slug/` from `docs/specs/_template/`.
4. Fill `spec.md`:
   - Problem from the user's side, no solution language.
   - Acceptance criteria in EARS form. Every criterion must be testable without asking anyone a
     question. If you cannot phrase one that way, the requirement is not understood yet: put it
     in Open questions instead of guessing.
   - List open questions honestly. A spec with no open questions on the first pass is usually a
     spec that did not look hard enough.
5. Ask the human the open questions, one at a time. When they are resolved, set
   `status: approved`.
6. Only then write `plan.md` (files touched, risks, decisions required, test strategy) and
   `tasks.md` (dependency-ordered, each with a verifiable done condition).
7. If the plan needs a decision that meets the ADR test, write the ADR **before** implementing,
   and reference it in the spec's `adrs:` frontmatter.
8. Add the spec to `docs/INDEX.md` and run `npm run lint:docs`.

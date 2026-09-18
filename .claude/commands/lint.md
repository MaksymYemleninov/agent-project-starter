---
description: Run the documentation gates and summarize what needs attention.
---

# Lint

!npm run lint:docs
!npm run check:adr

Then do the part the scripts cannot:

- **Contradictions.** Read the ADRs in order. Does any accepted one conflict with another, or with
  `docs/architecture/overview.md`? A conflict means one of them should be superseded.
- **Drift.** Does `docs/architecture/overview.md` still describe the code as it is now? Check the
  actual module layout, not the intent.
- **Duplicates.** Two documents covering the same ground is how both become wrong.
- **Stale specs.** Anything `in-progress` that nobody has touched in weeks is either abandoned or
  blocked; both deserve a status change.
- **Non-goals.** Has the code quietly crossed one?

Summarize as: what is broken, what is stale, what needs a human decision. Fix mechanical problems
(broken links, missing index entries, wrong frontmatter) directly. Do not fix anything that
changes meaning without asking.

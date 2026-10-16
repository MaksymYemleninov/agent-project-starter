---
description: How to mark text that exists only for an optional track. Loads when Markdown under .claude/ or docs/, or AGENTS.md, is in play.
paths:
  - ".claude/**/*.md"
  - "docs/**/*.md"
  - "AGENTS.md"
  - "README.md"
---

# Optional-track text

If a sentence, list item, table row or section is true only when an optional track is kept (it
names that track's agents, skills, commands or workflows), mark it so the adapter cuts it when the
track is disabled. The grammar is in `.claude/skills/gates-and-tracks/lifecycle.md`, section
"Track markers".

- Mark a whole paragraph, list item, table row or section, never part of a sentence. Reread what is
  left with the text cut: it must still read, and no heading may be left empty.
- Do not mark numbered steps: cutting one leaves a gap in the numbers. Write the track's checks as
  their own marked section.
- Never put a marker in section 2 of `AGENTS.md`. The principles are not track-specific, and the
  linter rejects it.
- `npm run lint:docs` names a disabled track's assets that are left outside a marker. If a line
  merely shares a word with an asset, end it with `<!-- track-ok: <reason of at least ten characters> -->`.
- Not for decisions, specs or the log: they are history and are never cut.

---
description: Rules for anything under docs/. Loads when documentation files are in play.
paths:
  - "docs/**/*.md"
---

# Documentation rules

- Add the `docs/INDEX.md` entry in the same change as the document. Later means never, and the
  linter fails the build either way.
- Update `last_verified` on substantive edits only: facts, sections, sources. Not on typos or
  formatting. A bumped date that reflects no verification is worse than a stale one.
- Never delete an ADR and never edit a decision into a different decision. Supersede it.
- Write only what you verified. Where the code or the human has not answered a question, write
  `<!-- TODO: the question -->` and say so in your summary, rather than a plausible sentence. A
  document full of plausible statements is worse than a missing one, because people trust it.
  "Not determined" and "none" are different statements.
- When a new fact contradicts an existing document, do not overwrite it. State the conflict in
  prose naming both sides, and escalate to the human.
- No secrets, tokens, keys or real credentials, including in examples. Use obvious placeholders.
- Write plain prose. No marketing language, no "leverage", no "seamless", no "robust".
- Acceptance criteria are always in EARS form. See `.claude/skills/writing-spec/`.

@AGENTS.md

## Claude Code

- `AGENTS.md` is the source of truth for this repository's agent behavior.
- This file exists only as a Claude Code compatibility shim so Claude Code imports the shared
  rules instead of duplicating them. Do not add rules here.
- Path-scoped rules live in `.claude/rules/`, procedures in `.claude/skills/`, enforcement in
  `.claude/settings.json`.

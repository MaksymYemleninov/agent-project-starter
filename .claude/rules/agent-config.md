---
description: How to edit the agent's own configuration. Loads when files under .claude/ are in play.
paths:
  - ".claude/**/*"
---

# Agent configuration rules

- Change `.claude/hooks/`, `.claude/skills/`, `.claude/commands/` and `.claude/settings.json`
  with the Edit or Write tool, not through a shell command (`sed`, a heredoc, `tee`). The sandbox
  protects these paths from shell writes, and a shell command that merely contains a secret file
  name as text can be refused by the secret guard. Edit goes through the human's approval.
- Say which of these files you will change before the first edit, so the approval prompts are
  expected.
- Do not run a command without the sandbox to get around a refused write. Report the refusal.

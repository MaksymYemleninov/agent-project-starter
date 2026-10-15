# Known limits of the gates

Part of [gates-and-tracks](SKILL.md). Moved from the template README as it stood.

## Known limits

Worth stating plainly, because a guardrail you trust more than it deserves is worse than none.

- **The permission layer is not a security boundary.** `permissions.deny` on `Read(./.env)` only
  stops the Read tool and the file commands Claude Code recognises. `grep -r KEY .` names no file,
  and `grep` and `find` are built-in read-only commands that run without a prompt whatever the
  allow list says. So the project enables Claude Code's sandbox (`sandbox` in
  `.claude/settings.json`): shell commands cannot read the project's secret files or
  `~/.aws`, `~/.config/gcloud`, `~/.azure` and `~/.kube`, at the operating-system level.
  `autoAllowBashIfSandboxed` is off, so the sandbox adds that boundary without removing a single
  permission prompt. The `PreToolUse` hook stays as the readable second line, and it parses
  commands so that prose and loaders (`--env-file .env`) do not trip it. On Linux and WSL2 the
  sandbox needs `bubblewrap` and `socat`; without them Claude Code warns and runs unsandboxed.
  Run `/sandbox` in the first session to see that it is active. `~/.ssh` is left readable so
  `git push` over SSH works. Still: no production credentials on the machine.
- **Hooks are reminders with teeth, not enforcement.** The Stop hook blocks once per session and
  then stands aside by design, because a hook that can block forever is a hook someone deletes.
  CI is the only gate that actually holds.
- **The ADR gate checks substance, not judgement.** It enforces a minimum: a real Context section,
  at least two options, a non-empty negative consequence, no leftover template placeholders. It
  cannot tell whether the reasoning is any good, and a determined author can pad past every
  threshold. That part is still review.
- **`/onboard` resumes, but does not replay.** `.claude/onboarding.json` records the phase reached
  and anything agreed but not yet written, so a session that dies mid-onboarding continues instead
  of starting over. It does not capture the conversation, so a resumed session may re-ask a
  question whose answer was never written down.
- **Agent scopes and the apply guard are a tokenizer, not a shell.** They read through quotes,
  subshells, `env`, `timeout`, `aws-vault` and `sh -c`, but a command built to evade them (an
  alias, a script file) will. Frontmatter hooks are a Claude Code feature; another runtime reading
  these agents gets the prompts without the enforcement.
- **`/repair` treats the test as the specification.** A wrong or flaky test gets code bent to fit
  it. It has been tested against a fake `claude`, not yet against the real CLI.
- **The infra track is unproven end to end.** The hooks are tested; the agents and skills are
  prompts that have not yet run a real bootstrap. Treat the first one as the test.
- **The gate defaults assume a JavaScript layout.** `sourcePaths` in `.claude/gates.json` lists
  `src/`, `app/`, `lib/` and friends. For a Python or Go project those match nothing and the Stop
  hook quietly stops noticing source changes, so `/onboard` rewrites them in phase 5. If you skip
  onboarding, edit that file first.

---
type: adr
id: "0019"
status: accepted
date: 2026-09-25
deciders: [maintainers]
tags: [security, tooling]
supersedes: null
superseded_by: null
---
# 0019 - Contain secrets with the sandbox, and parse commands in the secret guard

## Context

A full review before the first real project found two opposite failures in how the template keeps
agents away from secrets.

The guard was too loose where it mattered. `grep -rn DATABASE_URL .` printed a value from `.env`.
Claude Code's documentation is explicit: `Read` deny rules cover the built-in file tools and file
commands it recognises, but not "a command that reads files without naming them, such as
`grep -r pattern .`", and `grep`, `find` and `cat` are built-in read-only commands that run
without a prompt in every mode, whatever the allow list says. Removing them from `allow` would
change nothing. The same documentation names the sandbox as the OS-level control for this.

The guard was too tight where it did not matter. `pre-bash.mjs` split the whole command on quotes
and spaces and treated every piece as a possible path, so it refused `git commit -m "add .env to
gitignore"`, `cp .env.example .env`, `docker compose --env-file .env up` and any file named
`secrets.ts`. Those are first-hour onboarding commands; a guard that refuses them teaches people to
route around it.

Separately, CI linted a project's documents at the building stage while the project was still at
exploration, which ADR 0004 promises blocks nothing.

What is not known: the sandbox settings were written from the documentation and have not been run
in a session yet. On Linux and WSL2 the sandbox needs `bubblewrap` and `socat`; without them Claude
Code warns and runs commands unsandboxed.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep the hook as it was and document the gap | No change | Secrets readable through `grep`; the hook blocks normal work | Low |
| Add `ask` rules for `grep`, `rg`, `find` | Stays in the permission layer | A prompt on every search; still text matching, and `node -e` or a script reads files anyway | Low |
| Enable the sandbox with the secret files and cloud credential directories unreadable, keep every prompt (`autoAllowBashIfSandboxed: false`), and make the hook parse commands | OS-level: holds for any command and its children; fewer false refusals | Depends on platform support; caches outside the project need `allowWrite`; untested until the first session | Low |
| Enable the sandbox with auto-allow on | Far fewer prompts | Destructive commands inside the project would run unasked, against AGENTS.md principle 6 | Low |

## Decision

We will contain secrets with Claude Code's sandbox, keeping every permission prompt, and keep the
secret hook as a second line that judges parsed commands.

## Consequences

### Positive

- `grep -r`, `find -exec cat` and scripts that open files cannot read `.env`, keys, state or the
  cloud credential directories, when the sandbox is active.
- The hook stops refusing commit messages, titles, `echo`, `ls`, env-file loaders and creating
  `.env` from the example, and still refuses reads through redirects, substitutions, `sh -c` and
  interpreter code. Sixteen gate tests pin both sides.
- A project at exploration gets a green CI job with warnings instead of a red one.

### Negative

- The sandbox is untested in a real session. The first session should run `/sandbox` and try
  `grep -r` on a fake `.env`.
- Commands that write outside the project and the listed caches, or reach hosts outside the
  allowlist, fall back to an unsandboxed retry with a prompt. Expect some of those at onboarding.
- `~/.ssh` stays readable so `git push` over SSH works.
- The `.env` read denies are now a list of names (`.env.local`, `.env.production`, ...) so that
  `.env.example` stays readable inside the sandbox; an unusual name is caught by the hook only.
- At exploration, a real regression in the gate tests shows as a warning, not a failure.

### Follow-ups

- Verify the sandbox in the first project session and adjust `allowWrite` and `allowedDomains`
  from what actually prompted.

## Revisit when

The first session shows the sandbox inactive or in the way, Claude Code changes how `Read` rules
reach Bash, or a secret is read in a way this does not cover.

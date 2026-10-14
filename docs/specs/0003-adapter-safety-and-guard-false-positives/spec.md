---
type: spec
id: "0003"
status: done
date: 2026-10-14
owner: maintainers
adrs: ["0019"]
ui: false
design: null
---
# 0003 - Adapter safety and fewer false positives in the shell guards

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

A first full onboarding of a derived project (7 phases, Python stack) hit four defects in the
template's tooling:

1. `scripts/adapt-template.mjs --reset-records` removes files first and writes
   `.claude/settings.json` last. Under Claude Code's sandbox those paths are not writable, so the
   run died half-way, although `settings.json` was being rewritten with identical content.
2. The adapter error `Unregistered files: <name> 2.md` does not say the file is a Finder or iCloud
   copy. The reader compared files by hand; the repository had grown 103 such copies by the end.
3. After a reset, `docs/INDEX.md` lists ADR 0001 before ADR 0000: the stub line is replaced up to
   the 0000 line, so the new entry lands in front of it.
4. `pre-bash.mjs` denies a whole command when the body of a heredoc merely contains a secret file
   name such as `.env` (a `compose.yaml`, a `.dockerignore`, a spec). The guard reads heredoc
   bodies as if they were commands. This was reproduced while writing this very spec.

Nothing warns at session start that the repository sits in a folder a sync service rewrites.

## Goal

The adapter either changes everything it planned or nothing, says what a stray copy is, and keeps
the index in order; the shell guards read a heredoc as data unless it is code for an interpreter;
a session in a synced folder says so.

## Non-goals

- Making the adapter transactional after the preflight (rollback of a failure mid-run).
- Detecting or removing iCloud copies automatically.
- Changing what the secret guard treats as a secret (`secretPaths`), or the infrastructure
  mutation list.
- Preflight of the environment during `/onboard` (specified separately).

## Users and triggers

A maintainer or agent running `/onboard` phase 0 or 5 (`--reset-records`, `--disable`); an agent
writing a config file through a heredoc; anyone opening a session in a repository under
`~/Documents`, `~/Desktop` or `~/Library/Mobile Documents`.

## Acceptance criteria

Adapter:

1. If any file the adapter would remove or rewrite is not writable, then the adapter shall exit
   with status 1, name every such path in the error, and change nothing.
2. When the content to write equals the content on disk, the adapter shall not write that file and
   shall not require it to be writable.
3. If an unregistered file has a name segment ending in ` <digits>` before its extension and the
   same path without that suffix exists, then the error shall name the original and say it looks
   like a Finder or iCloud copy.
4. When `--reset-records` runs, the adapter shall leave the ADR entries in `docs/INDEX.md` in
   ascending order, with the stub entry and its continuation line removed.

Shell guards (`scripts/commands.mjs`, read by `pre-bash.mjs` and the agent scope hook):

5. When a heredoc has a quoted delimiter, the guards shall not read its body as commands or
   arguments, so `cat > compose.yaml <<'EOF'` with a secret file name in the body is allowed.
6. When a heredoc has an unquoted delimiter and its body contains a substitution (`$(` or a
   backtick), the guards shall read the body as commands.
7. When a heredoc is the input of an interpreter (`sh`, `bash`, `zsh`, `python`, `python3`, `node`,
   `ruby`, `perl`, `deno`, `bun`, `php`), the guards shall read the body as commands, whatever the
   quoting.
8. If a heredoc line also names a secret as a redirect target or argument (`cat > <secret> <<EOF`,
   `cat <<EOF > <secret>`), then the secret guard shall still deny it.
9. If `<<` appears inside quotes, then the guards shall not start a heredoc, so
   `echo "<< EOF"; cat <secret>` is still denied.
10. If a heredoc has no terminating line, then the guards shall treat the rest of the input as its
    body, as a shell does.

Session start:

11. Where the project directory is inside `~/Documents`, `~/Desktop` or `~/Library/Mobile
    Documents`, the SessionStart hook shall add one line saying the folder may be synced and may
    produce `* 2.*` copies; elsewhere it shall add nothing.

## Security

Criteria 5-7 loosen the secret guard and the agent scope hook: text that used to be read as
commands is now data. The cases where it is code stay strict (6, 7), the redirect and argument
forms on the heredoc line stay strict (8), and quoting cannot hide a command from the guard (9).
The guard remains an accident stopper, not a boundary
([ADR 0019](../../decisions/0019-contain-secrets-with-the-sandbox.md)). A body fed to a program
by a pipe (`cat <<EOF | sh`) is read as data for the first segment, and the receiving segment is
judged as before; that gap is accepted, as for any obfuscated command. The adapter preflight
opens existing files for update without changing them; it does not widen what the adapter may
touch (`safePath` is unchanged). The session-start line reveals no data.

## Out of band

none

## Open questions

- [x] Does `open(path, 'r+')` fail under the Seatbelt sandbox on a denied path, where
  `access(W_OK)` may not? Checked in task 3 against this session's sandbox-denied paths.

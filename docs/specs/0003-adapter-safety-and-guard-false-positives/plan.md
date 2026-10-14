---
type: plan
spec: "0003"
status: done
date: 2026-10-14
---
# 0003 - Implementation plan

## Approach

Adapter: compute every output (the three JSON files, edited Markdown, and for a reset the index,
the log and the renamed ADR) before touching anything, drop outputs identical to disk, then probe
every path that will change. An existing file is probed by opening it with `r+` and closing it, a
new file by checking its directory with `W_OK`; `access(W_OK)` alone may not see a sandbox
denial. Any failure throws with the full list before the first removal. The index fix replaces the
stub entry in place and inserts the 0001 entry after 0000. The copy hint is added where
`Unregistered` is reported in `scripts/tracks.mjs`.

Guards: heredocs are handled once, in `parse()` in `scripts/commands.mjs`, so the secret guard
and the agent scope hook agree. On an unquoted `<<` operator it records a pending heredoc
(delimiter, quoted or not, `<<-`); at the next newline outside quotes it consumes lines up to the
delimiter. The body is dropped, unless the delimiter is unquoted and the body holds a substitution
or the command is an interpreter, in which case the body is parsed as further segments. The
operator itself is no longer emitted as a redirect with the delimiter as its target.

[PROPOSED: parse the body recursively with `parse()` rather than flagging the segment, so each
line is judged as the command it would be.]

Session start: one `startsWith` check on the project directory against three home subfolders.

## Files touched

| Path | Change | Risk |
|---|---|---|
| `scripts/adapt-template.mjs` | compute outputs first, skip unchanged, preflight writability, index order | medium |
| `scripts/tracks.mjs` | copy hint on `Unregistered` | low |
| `scripts/commands.mjs` | heredoc handling in `parse()` | high |
| `.claude/hooks/session-start.mjs` | synced-folder warning | low |
| `scripts/test-gates.mjs` | guard cases for criteria 5-10 | low |
| `scripts/test-regressions.mjs` | adapter cases for criteria 1-4 | low |
| `docs/INDEX.md`, `docs/log.md`, `.claude/tracks.json` | register the spec and its record | low |

## Data changes

none

## Decisions required

None. The change stays inside [ADR 0019](../../decisions/0019-contain-secrets-with-the-sandbox.md):
the guard still stops accidents, not intent.

## Test strategy

Gate tests drive the real hook with commands for criteria 5-10, both the allow and the deny
side. Regression tests run the adapter in a fixture copy: a read-only file for 1, an unchanged
`settings.json` made read-only for 2, a `foo 2.md` copy for 3, a reset for 4 (criterion 1 is
skipped when running as root, where `r+` cannot fail). The session-start line (11) is checked by
running the hook with `CLAUDE_PROJECT_DIR` under a temporary `HOME`. `npm run check` and
`test:derived`.

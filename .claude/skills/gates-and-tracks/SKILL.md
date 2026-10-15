---
name: gates-and-tracks
description: How this project's documentation gates, hooks, track ownership and lifecycle checks work, and what they do not cover. Read before changing `.claude/gates.json`, `.claude/tracks.json`, agent scopes, hooks or the adapter, before running /harden, and when a gate or a guard refuses something and you need to know why.
---

# Gates and tracks

How the machinery that ships with this repository works. These sections were the template's
README; they live here so that a project keeps them after its README is replaced by its own
([ADR 0020](../../../docs/decisions/0020-write-the-project-readme-instead-of-inheriting-the-templates.md)).
The known limits are in [limits.md](limits.md); track ownership, the adapter, agent scopes, rules and the repair loop
are in [lifecycle.md](lifecycle.md).

## Gates are advisory until you say otherwise

A new project starts at `stage: exploration` in `.claude/gates.json`. The gates run, report what
they find, and block nothing. This is deliberate: a project whose shape changes weekly should not
have pull requests blocked over a missing decision record about code that may not exist next week.

When the project stops being an experiment, run `/harden`. The gates then hold: a pull request that
moves architecture, dependencies or the guardrails themselves without recording why will fail.

The one check that runs at every stage is the secret guard, because a leaked credential is not a
process question.

## The idea behind the gates

Prose reminders in an instruction file do not survive a long session. An agent reads
"remember to write an ADR", works for two hours, and ships without one. So the rules that matter
are not prose:

- a `Stop` hook checks for missing documentation before the session ends,
- `npm run lint:docs` validates structure, frontmatter, links, orphans and staleness,
- `npm run check:adr` fails a pull request that changes `docs/architecture/` or dependencies
  without adding a decision record,
- `npm run check:docs` fails a pull request whose code arrives without its documentation, in
  proportion: a new file needs a `docs/log.md` entry, a change across `docs.filesWithoutSpec`
  files a spec or ADR too, a small edit nothing. The Stop hook applies the same rule locally,
- escapes are a `No-docs-reason:` or `No-ADR-reason:` line in the pull request description, of at
  least 20 characters, re-checked when the description is edited. A label is not a reason,
- `npm run test:gates` tests the gate mechanisms with controlled profiles in a disposable copy of the repository,
  because every bug found in them so far would otherwise have come back on the next edit.

Reminders are cheap and unreliable. Hooks catch forgetfulness. CI is the only thing that actually
holds. All three are wired up here.

## Things that must not quietly come back

Most gates check that something is written down. Four check that it stays right:

- **Markers.** `markers` in `.claude/gates.json` lists past fixes as a file and a string that must
  stay in it, with the reason. An agent that "simplifies" the fix away fails lint with that reason.
  Add one whenever you fix a bug that looks like needless complexity.
- **Warning ratchet.** `/harden` records the warning count in `.claude/lint-baseline.json`. From then
  on it may fall and not rise; `npm run lint:docs -- --update-baseline` lowers it after a cleanup
  and never raises it.
- **ADR compliance.** `code-reviewer` checks the diff against accepted decisions, not only for new
  ones missing, and the linter rejects supersede chains that loop.
- **Compaction.** After a context compaction the start hook puts the branch, the uncommitted files
  and the tasks marked `doing` back in front of the agent.

## Tuning

`.claude/gates.json` holds everything the gates argue about: which paths count as source, which
files are dependency manifests, which are guardrails, how many source files may change before a
spec is expected, and which paths are treated as secret-bearing. Changing it is itself a guardrail
change, so the ADR gate asks for a record.

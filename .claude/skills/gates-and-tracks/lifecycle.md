# Ownership, scopes, rules and repair

Part of [gates-and-tracks](SKILL.md). Moved from the template README as it stood.

## Template ownership and lifecycle checks

`.claude/tracks.json` assigns every agent, skill file, command, rule, scope profile, plugin and
workflow to `core` or one optional track. `lint:docs` checks completeness, duplicates, enabled
items that are missing and disabled items that remain. Activating a `.yml.example` workflow keeps
its ownership. Register new project tooling in the manifest in the same change.

Onboarding and `npm run test:derived` use `scripts/adapt-template.mjs`. Its default is a preview;
`--confirm` applies the reviewed local cleanup. `--disable infra,design` removes owned items;
`--reset-records` removes exactly the registered template ADRs and specs, installs the inherited
record and resets the template log. It refuses completed onboarding, invalid paths and symlinks.

`npm run test:derived` creates a disposable project, disables optional tracks, replaces fixture
placeholders and runs `npm run check` at exploration and building, including a warning baseline.
It verifies the mechanical portion of hardening, not deployments, scanners or human approvals.
`npm run test:regressions` exercises the defects fixed during the template lifecycle review.
Neither command spawns a paid agent. CI runs both separately from `check` to avoid recursion.

Deleted ADRs never count as coverage. Deleting a project ADR is a separate violation even with
another ADR or an escape reason. Only exact template ADR paths registered in the comparison-base
manifest can be cleaned up before onboarding completes. Exploration reports violations without
blocking; building blocks them. Supersede project records rather than deleting them.

`repair` exits 3 for a missing/non-executable test runner, command-not-found output, timeout or
signal termination, before generating a repair plan or starting an agent.

## Agents stay in their lane

`tools:` says which tools an agent may call, not what it may do with them. Every agent that can
write or run commands carries a hook in its frontmatter that checks each call against its profile
in `agentScopes` in `.claude/gates.json`: which paths it may write, which commands it may run. The
reviewers cannot edit what they review; the architect writes plans and proposed ADRs, not code.
A missing profile refuses everything, and the linter fails if an agent names one that does not
exist.

## Repairing a failing test

`/repair` (or `npm run repair -- --test "<command>" --test-file <path>`) runs headless `claude -p`
attempts with the limits enforced by the script rather than asked of the agent: a total dollar
budget, a turn cap, edits only inside `sourcePaths`, Bash only for the test command. After every
attempt the script checks the test files' hashes and every changed path, and runs the test itself;
the test's exit code is the only judge. It refuses a dirty tree and a test that already passes, and
without `--confirm` it only prints the plan.

## Path-scoped rules

`.claude/rules/*.md` is what keeps the constitution under 200 lines. A rule that applies to one
directory or one file type goes here instead of `AGENTS.md`, with a `paths` glob in its
frontmatter:

```markdown
---
description: one line, what this covers
paths:
  - "src/api/**/*.ts"
---

- All API endpoints validate input at the boundary.
```

Rules with `paths` load only when Claude touches a matching file. A rule **without** `paths` loads
into every session and costs context every time, so `npm run lint:docs` warns about it. That is a
mistake worth catching: it is invisible at runtime and it compounds.

`/onboard` replaces the placeholder rules with real ones for the chosen stack and deletes the rest.

## Track markers

Text that is true only when an optional track is kept is marked, so disabling the track cuts it
with the track's files ([ADR 0021](../../../docs/decisions/0021-mark-optional-track-text-and-cut-it-with-the-track.md)).
Two forms:

```markdown
<!-- track:infra -->
Any paragraph, list item or whole section, between two marker lines that each stand alone.
<!-- /track:infra -->

| a table row | its cells | <!-- track:infra -->
```

- `--disable infra` cuts both forms for `infra`, marker lines included; a kept track keeps its
  markers and text, so it can still be dropped later. The preview prints every file it would edit.
- Blocks do not nest, must close, and name a track from `.claude/tracks.json` other than `core`.
  Markers inside fenced code blocks are examples and are ignored.
- The adapter cuts in `AGENTS.md`, the commands, agents, rules and skills, `docs/` and the README. It
  does not touch decisions, specs or the log, nor `/onboard`, which names every track as its job.
- `AGENTS.md` section 2 never holds a marker.
- While a track is disabled, `npm run lint:docs` fails for each line that names one of its assets
  (skill directory, agent, command, workflow, scope profile) outside a marker, a code block or a
  Markdown link. A line that only shares a word with an asset ends with
  `<!-- track-ok: reason of at least ten characters -->`.

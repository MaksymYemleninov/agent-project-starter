<!--
STUB. /onboard phase 7 writes the project's README.md from this shape and then deletes this file.
Rules for filling it:
- Every sentence comes from a document that already exists. Do not invent; do not describe the template.
- Where a fact is not known, write `<!-- TODO: the question -->` instead of a plausible sentence.
- List only commands that phase 6 ran and showed working. AGENTS.md stays the source for commands;
  copying them here can drift, so name that in the Run it section.
- Mention no track that was disabled. No tokens, keys, internal hostnames or connection strings.
- Delete every comment like this one, and keep the whole README under 60 lines.
-->

# <project name>

<!-- Purpose. One or two sentences, from docs/product/vision.md. What it is and who it is for. -->

## Status

<!-- Stage and what exists: the stage in .claude/gates.json, what phase 6 proved runs, the first
spec in docs/specs/. One short paragraph. -->

## Run it

<!-- Install, run, test and lint commands, copied from AGENTS.md section 4 and only those that
phase 6 ran. End with: "AGENTS.md is the source for these commands; if one fails, fix it there." -->

## Layout

<!-- Source directories and what each holds, from the code map in AGENTS.md and
docs/architecture/overview.md. A short list, not a tree of every file. -->

## Documentation

<!-- Links: docs/INDEX.md (map of every document), docs/specs/ (features), docs/decisions/
(decisions and why), docs/security/threat-model.md. One line each. -->

## Working with agents

<!-- Two or three sentences: AGENTS.md is the constitution, the agent reads docs/INDEX.md first,
changes carry their documentation. Link .claude/skills/gates-and-tracks/SKILL.md for how the gates
and guards work. -->

## Conventions

<!-- From AGENTS.md section 5: branch and pull request flow, commit subjects. Three or four lines. -->

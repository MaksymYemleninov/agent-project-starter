---
description: Pre-pull-request gate. Verifies the work and its documentation, then opens the PR.
---

# Ship

Run the full gate before asking for review. Show real output at each step; a summary is not
evidence.

## 1. What changed

!git status --short
!git diff --stat

## 2. Gates

Run each and fix what it reports. Do not proceed past a failure.

- `npm run lint:docs`
- `npm run check:adr`
- the project test command from the Commands table in @AGENTS.md
- the project lint command from the same table

## 3. Documentation check

- Does every behavior change have a spec or an ADR covering it? If not, write it now.
- Is every new document listed in `docs/INDEX.md`?
- Does `docs/log.md` have an entry for this work: 3 to 6 bullets, what changed and where, linking
  to the spec or ADR that holds the detail?
- Did anything you learned contradict an existing document? Say which, and do not overwrite it
  silently.
- Did this change fix a bug an agent could plausibly "simplify" back in? Add a marker to
  `markers` in `.claude/gates.json`: the file, a string that must stay while the fix exists, and
  why, for someone who does not know the history.
- If `.claude/lint-baseline.json` exists and lint now reports fewer warnings, lower it:
  `npm run lint:docs -- --update-baseline`.

## 4. Review

For anything past Tier 1, run the `code-reviewer` subagent on the diff. Infrastructure code is
reviewed by `infra-reviewer` when `infra-change` calls for it (three or more components), not
twice here. Any verdict other than `READY - no findings` means fix and run it a second
time, handing it its first report. After the second cycle, stop iterating: whatever remains goes
into the PR description for the human, with the reviewer's words.

## 5. Rule gaps

List anything this change ran into that no rule in `.claude/rules/`, no skill and no ADR would have
prevented, plus the reviewer's Rule gaps section. One line each, naming the file the rule would go
in. Ask the human which to add. Add only those, in this change or a follow-up. None is a fine
answer; an invented one is not.

## 6. Task status

Update `tasks.md` in the relevant spec. Move blocked items to the Blocked section with a reason.
If the spec is complete, set its `status: done`.

## 7. Pull request

- Branch, if not already on one: `git switch -c <type>/<slug>`
- Conventional commit subject, body explaining **why**, not what.
- Push and open the pull request. **Ask before pushing.**
- PR description: what changed, which spec or ADR it implements, how it was verified, what was
  deliberately left out.

If any gate failed and you could not fix it, say so explicitly with the output. Do not open the
pull request and hope review catches it.

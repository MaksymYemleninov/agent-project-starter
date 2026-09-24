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
- `npm run check:docs`: a new file needs a log entry, a change across the threshold a spec or ADR
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

Security review runs separately, with a clean context, for Tier 2 and up and for any change that
touches authentication, authorization, input handling, personal data, secrets, dependencies or
infrastructure exposure, whatever its tier:

- the `security-reviewer` subagent in diff mode, same two-cycle rule. Any HIGH blocks the pull
  request; a MEDIUM is fixed or accepted in an ADR;
- the built-in `/security-review` on the branch, as a second opinion from a different prompt.

If the change adds an entry point, data store, role or integration, `docs/security/threat-model.md`
changes in the same pull request.

A change to the interface (a spec with `ui: true`, or any component or style file) also gets the
`design-reviewer` subagent, same two-cycle rule: tokens instead of hardcoded values, every state
designed, the accessibility floor, and fidelity to the prototype.

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
  deliberately left out. If a gate genuinely does not apply, a `No-docs-reason:` or
  `No-ADR-reason:` line with the reason (20 characters at least); a label is not a reason.

If any gate failed and you could not fix it, say so explicitly with the output. Do not open the
pull request and hope review catches it.

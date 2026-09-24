---
description: Move the project from exploration to building, turning the gates from advisory into blocking.
---

# Harden

The project has been running with advisory gates: they reported, nothing blocked. This turns them
on. Do it when the project stops being an experiment, which usually means one of:

- something is deployed where a person other than you can reach it,
- someone else has started contributing,
- you have stopped rewriting the architecture weekly.

Not before. Gates on a shape that changes weekly generate records about code that will not exist,
and that is how the practice gets abandoned.

## Steps

1. Run `npm run lint:docs` and read every error. At exploration stage they were printed and
   ignored; now they will fail the build. Fix them before flipping the flag, not after.
2. Check the documents the gates assume exist and are real, not templates:
   - `docs/product/vision.md`, `scope.md`, `non-goals.md` reflect the project as it is now, not as
     it was imagined at onboarding.
   - `docs/architecture/overview.md` describes the code that exists. Read the actual module layout
     and compare; this is the document that drifts first.
   - `docs/ops/environments.md` names where secrets live.
3. Check `.claude/gates.json`: do `sourcePaths` actually match this repository's layout? A glob
   that matches nothing means the Stop hook has been silently ignoring source changes. Verify by
   listing the files it matches, do not assume.
4. Record the decisions already made but never written. There are always some: the ones taken
   during exploration when nothing was asking for them. Write them now, dated when they were made
   rather than today, with a note that they are recorded retroactively.
5. **A test command must exist, run, and fail when the code is wrong.** Verify the last part:
   break something on purpose, watch the tests go red, put it back. Test setup was deliberately
   deferred at onboarding (see the inherited tooling ADR in a derived project), and this is the
   checkpoint where that deferral either gets paid off or turns into a project with no tests.
   Also check that `.github/workflows/code.yml.example` has been renamed to `code.yml`, or the
   suite is not running in CI at all. The rest of the mechanical floor from
   `.claude/skills/engineering-rulebook/SKILL.md` section 2 runs there too: format check, lint with
   warnings as errors, strict type check, and the boundary checker. Break a boundary on purpose and
   watch CI go red, the same way as the tests.
6. Security holds before anything else does. Blocking, each one:
   - `docs/security/threat-model.md` exists, was verified since the last entry point was added,
     and every high threat has a control in place (with evidence) or an accepting ADR;
   - the ASVS level is an accepted ADR;
   - `/security` has run in the last month and its report has no open HIGH;
   - `.github/workflows/security.yml.example` renamed to `security.yml` and green, the secret scan
     in `ci.yml` green, and `.github/dependabot.yml.example` activated (or Renovate) for the
     ecosystems in use;
   - `.claude/claude-security-guidance.md` holds this project's rules, not the stub;
   - the `security-guidance` plugin is enabled in `.claude/settings.json`.
7. If the project has a user interface: `docs/design/system.md` is `stable` and its component
    inventory matches `components/ui/` (or the stack's equivalent); the linter forbids hardcoded
    colours and arbitrary values in UI code; the end-to-end suite runs an automated accessibility
    check (axe) on the key pages; and a `design-reviewer` pass over the current UI has reached
    `READY`.
8. If the project has infrastructure code, it holds too:
   - `.github/workflows/infra.yml.example` renamed to `infra.yml` and green;
   - the state backend, its locking and who may apply are in `docs/ops/environments.md`;
   - `infra.paths` and `infra.foundations` in `.claude/gates.json` match the real tree (list what
     they match, do not assume);
   - the rulebook's naming and Project decisions sections reflect the accepted ADRs;
   - an `infra-reviewer` code review of the current tree has reached `READY`.
9. Set `"stage": "building"` in `.claude/gates.json`.
10. Run `npm run check` (docs, ADR drift, gate tests, regressions) and `npm run test:derived`, the
    same set CI runs. Everything must pass. If something does not, fix it rather than reverting
   the stage.
11. Settle branch protection, one way or the other. The drift gate runs on pull requests only, so a
   direct push to the default branch bypasses it entirely.
   - If protection is available, enable it: require the pull request checks, forbid direct pushes.
   - If it is not, which is the case on a private repository without a paid plan, **record the
     acceptance as an ADR** rather than leaving it implicit. This item is then satisfied by the
     record, not by the setting. An item that cannot pass trains people to skip checklist items,
     which is the failure this checklist exists to prevent.

   Either way, create the escape label once, or the only documented way past the gate does not
   exist:

   ```bash
   gh label create no-adr-needed --color 0E8A16 --description "Reason is in the PR description"
   ```

12. Rename `docs/ops/_runbook.md` into place and fill it. By this point there has been a deploy, so
   there is something to write: the exact commands, the rollback, and what to check when it breaks.
   An untested rollback is a hope.
13. Name the rule gaps the exploration period exposed: mistakes that repeated, reviewer findings
    that no rule would have prevented. Propose the rules; the human picks which are written.
14. Lock in the warning count: `npm run lint:docs -- --update-baseline` creates
    `.claude/lint-baseline.json`, and from then on warnings may fall but not rise. Before it, read
    every warning: the baseline freezes whatever is there as acceptable.
15. Look through `docs/log.md` for bugs fixed during exploration that could silently return, and
    add a marker for each to `markers` in `.claude/gates.json`.
16. Add an entry to `docs/log.md` saying the project moved to `building` and why now.

## Afterwards

Pull requests that change architecture, dependencies or guardrails without a decision record will
fail. That is the point. The escape is the `no-adr-needed` label with a written reason, and if you
reach for it more than occasionally the triggers are wrong: narrow them in `.claude/gates.json`
rather than making the exit routine.

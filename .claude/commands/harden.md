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
   deferred at onboarding (`docs/decisions/0005-defer-code-scaffolding.md`), and this is the
   checkpoint where that deferral either gets paid off or turns into a project with no tests.
   Also check that `.github/workflows/code.yml.example` has been renamed to `code.yml`, or the
   suite is not running in CI at all.
6. Set `"stage": "building"` in `.claude/gates.json`.
7. Run `npm run check`. Everything must pass. If something does not, fix it rather than reverting
   the stage.
8. Enable branch protection on the remote if it is not on: the drift gate runs on pull requests
   only, so a direct push to the default branch bypasses it entirely. On a private repository this
   needs a paid plan; if it is unavailable, say so out loud rather than assuming the hole is closed.
   Also create the escape label once, or the only documented way past the gate does not exist:

   ```bash
   gh label create no-adr-needed --color 0E8A16 --description "Reason is in the PR description"
   ```
9. Add an entry to `docs/log.md` saying the project moved to `building` and why now.

## Afterwards

Pull requests that change architecture, dependencies or guardrails without a decision record will
fail. That is the point. The escape is the `no-adr-needed` label with a written reason, and if you
reach for it more than occasionally the triggers are wrong: narrow them in `.claude/gates.json`
rather than making the exit routine.

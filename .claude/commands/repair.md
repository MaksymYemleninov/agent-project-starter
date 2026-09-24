---
description: Make one failing test pass by fixing the implementation, in a bounded, budget-capped loop that cannot touch the test.
argument-hint: "<the failing test, or what is broken>"
---

# Repair

Failing: **$ARGUMENTS**

This runs `scripts/repair.mjs`, which spawns headless `claude -p` sessions with the limits enforced
outside them: a dollar cap, a turn cap, edits only inside the edit scope, Bash only for the test
command, the test files hashed and checked after every attempt, and the test's own exit code as the
only judge. Use it for a failure that is specific and well tested. Do not use it:

- when the test is new and nobody has checked it is right. The loop treats the test as the
  specification; a wrong test gets "fixed" code;
- for a flaky test. The loop cannot tell a fix from a lucky run;
- when the failure is environmental (a service down, a missing credential). That is not code to
  fix, per `AGENTS.md`;
- as a substitute for understanding a failure you are about to ship. Read the diff it produces.

## Steps

1. Identify the narrowest command that runs only the failing test, and the test file or files it
   exercises. Run the command yourself and confirm it fails for the reason the human described.
2. Make sure the working tree is clean: commit or stash first. The script refuses otherwise, so
   the repair is one diff with nothing else mixed in.
3. Dry run, and show the human the plan it prints (scope, protected files, attempts, models,
   budget):
   ```bash
   npm run repair -- --test "<command>" --test-file <path>
   ```
4. Ask the human to confirm the budget. Spending money is their call, and the permission layer
   asks for it too. Only then run the same command with `--confirm`.
5. Report the JSON result as it is. On exit 0, show the diff and review it like any other change:
   a green test is necessary, not sufficient. On exit 1, the changes are left in place: say what
   was tried and let the human decide whether to keep or `git restore`. On exit 5, say plainly
   that the agent touched a protected or out-of-scope file, and show which.

Defaults: 3 attempts, $2 total, `sonnet` then `opus` on the last attempt, 30 turns per attempt, edit
scope `sourcePaths` from `.claude/gates.json`. Override with `--attempts`, `--budget`, `--models`,
`--max-turns`, `--edit`.

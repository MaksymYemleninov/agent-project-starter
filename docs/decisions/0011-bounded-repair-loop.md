---
type: adr
id: "0011"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, tooling, testing]
supersedes: null
superseded_by: null
---
# 0011 - Repair failing tests in a loop whose limits live outside the agent

## Context

"Make this failing test pass" is one of the most common requests to a coding agent and one of the
least safe, for two reasons that have nothing to do with the model's skill.

First, the request has two solutions and one of them is editing the test. An agent under pressure
to reach green finds it: a loosened assertion, a skipped case, a special branch for the fixture.
The result looks like success in every report the agent writes, because by its own account the
test now passes.

Second, the loop has no natural end. After three failed ideas the agent tries a fourth, more
speculative one, then a fifth, in the same growing context, and the cost is open-ended. Telling it
"do not edit the test" and "stop after a few tries" is prose, the layer [ADR 0001](0001-enforce-documentation-in-ci.md)
already found does not hold.

A review of an open-source agent harness (ruflo) showed a workable shape: a script that runs
headless `claude -p` with a dollar cap, restricts its tools, refuses to start if the test already
passes, and uses the test's exit code as the only judge. It also showed the gap: its instruction
not to modify the test was prompt text only, nothing checked the test file afterwards, and its
Bash permission was unrestricted, so the loop could still cheat.

The flags this depends on were checked against the Claude Code documentation rather than recalled:
`--max-budget-usd`, `--max-turns`, `--allowedTools` and `--disallowedTools` with path and command
patterns, `--permission-mode dontAsk`, and `--output-format json` reporting `total_cost_usd`. The
documentation does not specify distinct exit codes for a budget or turn limit, so the script does
not rely on them.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep repairs in the interactive session | No new tooling; the human watches | Limits are prose; cost is unbounded; test edits are caught only if someone reads closely | Low |
| Have `test-writer` or a new subagent do repairs | Uses the existing scope hook | A subagent shares the session's budget and has no dollar cap; the scope hook cannot tell a test file from a source file by content | Low |
| A script around `claude -p`, with the test hash, scope check and judgement done by the script | Every limit enforced outside the agent; testable with a fake binary; dry run by default | Nested headless sessions are new ground; spends real money when confirmed | Low |
| Adopt the harness's script as is | Already written | Depends on its runtime, and lacks the test-file check that matters most | Medium |

## Decision

We will ship `scripts/repair.mjs` and `/repair`: a loop of at most ten `claude -p` attempts under a
total dollar budget split across them, allowed to read, edit only inside `sourcePaths` (or `--edit`),
and run only the test command, while the script itself hashes the test files, checks every changed
path against the scope, runs the test to decide success, refuses a dirty tree or an already
passing test, and does nothing without `--confirm`.

## Consequences

### Positive

- A test edited to pass is caught every time, by hash, not by reading.
- Cost has a ceiling set before the first token, and the human confirms it: the permission layer
  asks before `npm run repair` runs at all.
- The repair arrives as one diff on a clean tree, so review is the same as for any other change.
- The whole loop is covered by the gate tests against a fake `claude`, including the cheating
  cases.

### Negative

- The test is treated as the specification. A wrong test gets code bent to match it, and the loop
  reports success. `/repair` says not to use it on unreviewed tests, which is prose.
- A test command that creates untracked files (snapshots, reports not in `.gitignore`) trips the
  out-of-scope check and stops the loop, a false alarm until those paths are ignored.
- Nested `claude -p` inside an interactive session has not been run for real from this template;
  the tests use a fake binary. The first real run is the test of the integration.
- The edit scope is a glob list. A fix that genuinely belongs in configuration or a migration is
  outside it, and the loop can only report BLOCKED.
- Flaky tests pass by luck and are "repaired". Nothing here detects flakiness.

## Revisit when

The first real repairs have run. If most end in BLOCKED or out-of-scope stops, the default scope
is wrong; if a green repair is later found to have weakened behaviour the test did not cover, the
loop needs a second judge beyond the one test.

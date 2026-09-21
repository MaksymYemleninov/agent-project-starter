---
type: adr
id: "0003"
status: accepted
date: 2026-09-21
deciders: [maintainers]
tags: [process, tooling, ci]
supersedes: null
superseded_by: null
---
# 0003 - Run the ADR gate on pull requests only

## Context

The first push of this repository to a remote turned `main` red, and the reason was not a bug in
any script. It was the gate being asked a question it cannot usefully answer.

[ADR 0002](0002-configure-and-substantiate-the-gates.md) gave the drift gate two escapes: the
`no-adr-needed` label in CI, and `SKIP_ADR_CHECK="<reason>"` locally. Both were used as designed.
The commit that added the gate test suite touched guardrail files, did not meet the ADR test in
[ADR 0000](0000-record-architecture-decisions.md), and was skipped locally with a written reason
repeated in the commit message.

That reason does not survive the push. On a `push` event there is no pull request, so there are no
labels, and the environment variable was local to one shell. The workflow fell back to comparing
`HEAD~1` against `HEAD`, found the guardrail changes with no accompanying record, and failed.

Nothing can be done about that failure afterwards. The commit is already on `main`. Adding a record
retroactively would document a decision that was deliberately not made, and re-running the job
produces the same result forever. The run was also comparing the wrong thing: against a merge
commit, `HEAD~1` is the first parent, which is the state of `main` before the merge rather than the
base the change was reviewed against.

A check that reports failure where no action is available is worse than no check. It teaches people
to ignore the red mark, and then the checks that do matter get ignored with it. This is the same
failure family as a hook that always blocks: the mechanism survives, its authority does not.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave it, accept a red main | No work | Trains everyone to ignore CI, which costs the other gates their credibility | Low |
| Add a commit-message escape such as `[no-adr]` | Works on push and on PR | A third escape to maintain, and it moves the justification somewhere nobody reads at review time | Low |
| Write a retroactive ADR for the offending commit | Turns CI green immediately | Records a decision that was explicitly not made; corrupts the directory to satisfy a tool | Low |
| Run the drift gate on pull requests only | The question is asked where an answer is possible, and one escape covers every case | Direct pushes to `main` are unchecked for drift | Low |

## Decision

The drift gate runs on `pull_request` events only, as its own job. Documentation linting and the
gate test suite keep running on every push, because they check the state of the tree and that
question is answerable at any commit.

The residual hole, a direct push to `main` bypassing drift checking, is closed by branch
protection rather than by the gate: `AGENTS.md` already requires a branch and a pull request for
every change, and enforcing that on the remote is the correct layer. A gate cannot compensate for
a workflow rule that nothing enforces.

This also collapses two escapes into one. `no-adr-needed` on the pull request is now the only path,
which is the right one: it puts the justification in front of a reviewer who can disagree.
`SKIP_ADR_CHECK` remains for local runs, where it prevents a pointless failure while iterating.

## Consequences

### Positive

- Every failure the gate reports is now actionable at the moment it is reported.
- The base commit is the one the pull request is actually reviewed against, not a merge parent.
- One escape, visible at review time, instead of two with different reach.

### Negative

- A direct push to `main` is not checked for drift at all. This depends on branch protection being
  configured on the remote, which is a setting outside this repository and therefore invisible to
  anyone reading only the code. If that protection is absent, the gate has a hole that looks closed.
- Splitting the workflow into three jobs makes the CI file longer and adds a second checkout.
- The failure that produced this record stays on `main` as a red run in history. That is accurate:
  the commit really was unrecorded, and by the project's own test it was right not to record it.

### Follow-ups

- Enable branch protection on `main`: require the pull request checks, forbid direct pushes.
- If branch protection turns out to be unavailable, revisit this: a push-event gate with a
  commit-message escape is the fallback, and it is worse.

## Revisit when

Branch protection cannot be enabled on the remote, or a case appears where an undocumented drift
reaches `main` without passing through a pull request.

---
type: adr
id: "0001"
status: accepted
date: 2026-09-18
deciders: [maintainers]
tags: [process, tooling, ci]
supersedes: null
superseded_by: null
---
# 0001 - Enforce documentation in CI, not in prose

## Context

[ADR 0000](0000-record-architecture-decisions.md) established that decisions get written down. It
did not say what happens when nobody writes one, and the honest answer was: nothing.

Instruction files are context, not configuration. An agent reads "record your decisions" at the
start of a session, works for two hours, and ships without an ADR. This is not disobedience; the
instruction is competing for attention with everything else in the window, and by the end it has
lost. The same applies to humans under deadline.

So the question is not how to word the rule better. It is which layer the rule lives in.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Prose in `AGENTS.md` only | Free, no tooling | Degrades over a session exactly when it matters | Low |
| Hooks only | Fires at the right moment, in-session | Advisory; a hook that always blocks gets disabled | Low |
| CI only | Actually holds | Feedback arrives minutes later, after the context is gone | Low |
| All three, escalating | Reminder is cheap, hook is timely, CI is final | Three places to maintain, and false positives annoy | Low |
| Nothing, rely on review | No tooling | Reviewers miss absence far more reliably than they miss presence | Low |

## Decision

We enforce documentation at three escalating layers, each doing the job the one below cannot:

1. **Prose** in `AGENTS.md` and `.claude/rules/` states the rule. Cheap, guarantees nothing.
2. **Hooks** react in-session: `PostToolUse` speaks the moment an architectural file is edited,
   `Stop` blocks once per session if the branch carries undocumented work. Once, then it stands
   aside, because a hook that can block forever is a hook someone deletes.
3. **CI** is the only layer that actually holds. `lint-docs` validates structure; `check-adr-drift`
   fails a pull request that moves an architectural commitment with no decision record.

The hook and the CI gate share one definition of "changed" in `scripts/changed-files.mjs`:
committed work on the branch plus the working tree. They computed it separately at first and
disagreed, which meant the hook missed every agent that committed before stopping, which is most
of them.

The gate files themselves are triggers. Quietly relaxing the linter that is complaining is the
specific failure this is for, and it is invisible in a diff full of other changes.

There is an escape in both directions: the `no-adr-needed` label in CI, `SKIP_ADR_CHECK="<reason>"`
locally. Both demand a written reason. The escape exists because a gate with no exit gets removed
entirely the first time it is wrong.

## Consequences

### Positive

- The rule survives a long session, because it no longer depends on attention.
- Absence of documentation is caught at the same moment as a failing test, by the same mechanism,
  and argued about in the pull request that caused it.
- Both scripts have zero npm dependencies, so the gates work on day one, before a stack exists,
  and do not break when the stack changes.

### Negative

- False positives. Renaming a heading in `docs/architecture/overview.md` trips the gate. The
  escape hatch covers it, but it costs the author a sentence of justification every time.
- Three layers means three places to keep in sync. The shared `changed-files.mjs` reduces this to
  two behaviors, not one.
- The gate proves an ADR exists, not that it is any good. A record that says "we chose X because
  it is popular" passes. Content quality is still a human review problem and always will be.
- The escape hatch is honor-system. Someone determined to skip the practice can, every time. The
  gate is aimed at forgetting, not at circumvention.
- The permission layer in `.claude/settings.json` is not a security boundary: denying
  `Read(./.env)` does not stop a shell command that prints the same file. It reduces accidents.
  Containment is a different problem with different tools.

### Follow-ups

- `.claude/hooks/` holds the three hooks; `scripts/` holds the two gates plus the shared logic.
- If false positives become the common case rather than the exception, narrow the triggers before
  anyone starts reaching for the escape hatch by reflex. That reflex is how the practice dies.

## Revisit when

The escape hatch is being used more than occasionally. That is the signal that the triggers are
wrong, and the fix is to narrow them, not to widen the exit.

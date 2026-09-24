---
type: adr
id: "0001"
status: accepted
date: 2026-01-01
deciders: [template]
tags: [process, tooling]
supersedes: null
superseded_by: null
---
# 0001 - Tooling inherited from the template

> Stub. `/onboard` renames this into place on a first run and sets today's date. It replaces the
> template's own numbered records after `0000`, which describe how the tooling was built rather
> than anything about this project.

## Context

This repository started from `agent-project-starter`, and inherited a set of gates it is now held
to. Those gates exist because of decisions taken while building the template, and the reasoning
behind each is worth having, but it is not this project's history.

Carrying five records about the construction of a template into every project derived from it
crowds out the project's own decisions. On the first project built this way, six of the fourteen
records in `docs/decisions/` were about the tooling. Nearly half the reasoning a reader had to walk
through before reaching anything about the product.

The reasoning still has to be reachable, because a gate whose purpose is unknown gets disabled the
first time it is inconvenient. So it is summarised here and linked, rather than dropped.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Ship all five template records into every project | Nothing lost | Half the decision record is someone else's history before the project writes a line | Low |
| Ship none, let the gates be unexplained | Clean slate | An unexplained gate is a disabled gate | Low |
| One inherited record summarising them, linking the originals | Reasoning available, project record stays the project's | A summary can drift from what it summarises | Low |

## Decision

The gates are inherited and this project is held to them. The full records live in the template
repository; what they establish is:

- **Documentation is enforced in three escalating layers.** Prose states the rule and guarantees
  nothing. Hooks react within a session and are advisory by design, blocking at most once so that
  nobody disables them. CI is the only layer that actually holds.
- **The drift gate runs on pull requests only.** On a push there is no pull request, so neither
  escape from the gate exists and a failure is unfixable after the fact. A check that reports
  failure where no action is possible is worse than no check.
- **Gates are staged.** `stage` in `.claude/gates.json` is `exploration` on a new project: they
  report and block nothing. `/harden` moves it to `building` when the project stops being an
  experiment. The secret guard runs at every stage.
- **Test setup and code CI are not scaffolded at onboarding.** They arrive with the first feature
  that needs them, when the shape of the thing is known rather than guessed. `/harden` requires
  them before the gates start holding.
- **Agents stay in their lane, mechanically.** Every subagent that can write or run commands has
  a scope profile in `agentScopes` in `.claude/gates.json`, enforced by a hook in its own
  frontmatter: which files it may write, which commands it may run. A missing profile refuses
  everything. A reviewer cannot edit what it reviews.
- **Agents never change real infrastructure.** `apply`, `destroy`, `import` and state moves are
  refused for agents at every stage, like secret reads. The human runs them from a plan summary.
- **Infrastructure is optional and follows the same rules.** When the project owns
  infrastructure, `/infra` plans it into a spec, builds it in batches and reviews it. Changing an
  infrastructure foundation (state backend, root configuration, an environment) needs an ADR.
- **Fixes and warnings do not quietly regress.** `markers` in `.claude/gates.json` fail lint when
  a string guarding a past fix disappears. After `/harden`, `.claude/lint-baseline.json` lets the
  warning count fall but not rise.
- **Test repairs are bounded.** `/repair` runs headless attempts under a dollar and turn cap; the
  script, not the agent, checks that the test files are unchanged and judges by the test's exit code.
- **Security is designed in.** The threat model lives in `docs/security/`, the ASVS level is an
  ADR, every approved spec states its security impact, `security-reviewer` and `/security-review`
  check changes, the `security-guidance` plugin reviews every turn, and CI scans for secrets from
  the first push.
- **Gate behaviour is configuration, not code.** `.claude/gates.json` holds source paths,
  manifests, guardrail paths, thresholds and secret paths. Editing `scripts/` to change gate
  behaviour means the configuration is missing a knob.

Decision records in this project are numbered from `0002`.

## Consequences

### Positive

- The decision record is about this project from its second entry onward.
- The gates are explained in one place, at the level a reader needs to decide whether to follow
  them, rather than across five records about how they came to exist.

### Negative

- This is a summary, and summaries drift. If the template changes how a gate behaves, this record
  says something slightly untrue until someone notices, and nothing detects that.
- The detailed reasoning now lives in another repository. A reader who wants to know *why* the
  drift gate skips pushes has to go and find it, and may not.
- Five records collapsed into one means five separately supersedable decisions became one. Changing
  a single inherited behaviour in this project now requires superseding a record that also asserts
  four other things.

## Revisit when

This project diverges from the inherited tooling enough that the summary above is no longer an
accurate description of what it does. At that point supersede this record with one that describes
the project's own gates.

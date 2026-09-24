---
type: adr
id: "0012"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, security]
supersedes: null
superseded_by: null
---
# 0012 - Design security in from onboarding, and review it separately from code

## Context

Until now security in this template was one principle ("no secrets in the repository"), a secret
guard, a line in `code-reviewer`'s checklist, and checkov for infrastructure. Nothing asked what
the application had to protect, from whom, or at what depth, and nothing checked the answer. For
projects built mostly by agents that is the wrong default: an agent implements the criteria it is
given, and a spec that never names an abuse case produces code that never defends against it.
Broken object-level authorization, the most common real breach in small products, is exactly the
class of bug that no happy-path criterion reveals.

Three constraints shaped the answer. The owner put security first among the goals for the
template, above design and code style. Onboarding already interrogates the idea one question at a
time, so the cheapest moment to ask security questions is one that already exists. And there are
now first-party tools worth using rather than rebuilding: Anthropic's `security-guidance` plugin
(pattern warnings on every edit, an LLM review of each turn's diff, an agentic review at commit,
with a project rules file it reads), and Claude Code's built-in `/security-review`. Both were
checked at their source, including the plugin's settings keys, its 8 KB limit on project rules,
and that it sends diffs to the model endpoint on every turn.

One tooling detail forced a choice: the gitleaks GitHub Action needs a licence for repositories in
an organisation, which is where client projects live, while the gitleaks CLI is free to run.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Leave security to `code-reviewer` and the plugin | Nothing new | No threat model, no level, nothing ties abuse cases to tests; a combined reviewer trades security depth for general correctness | Low |
| Plugin and scanners only | Mechanical, cheap to adopt | Finds vulnerability classes, not missing authorization logic the spec never asked for | Low |
| Threat model at onboarding, ASVS level as an ADR, a Security section in every spec, a separate security reviewer, the plugin, scanners in CI, all checked by `/harden` | Security becomes requirements that get tested; each layer catches what the others miss | More onboarding questions, one more reviewer pass per change, plugin cost per turn | Low |
| Require an external security review before `/harden` | Strongest assurance | Not available for most small projects; would make the gate one that cannot pass | Low |

## Decision

We will make security a track that starts at onboarding: security questions in phase 2, a threat
model in `docs/security/` in phase 3, an ASVS level ADR in phase 4 and project rules for the
`security-guidance` plugin in phase 5; a required `## Security` section in every approved spec; a
read-only `security-reviewer` agent run by `/ship` alongside the built-in `/security-review`; a
`/security` whole-project audit writing a dated report; a secret scan in CI from day one with
dependency and static analysis in an inactive `security.yml.example`; and `/harden` blocking on all
of them.

## Consequences

### Positive

- Abuse cases are written as `If ...` criteria before the code exists, so the controls get tested
  like any other behaviour.
- Four independent layers look at each change: the plugin on every edit and turn, the security
  reviewer with the threat model, `/security-review`, and scanners in CI.
- "Secure enough" has a definition per project, the ASVS level, which a reviewer can check against
  rather than argue about.
- Secret scanning runs on every project from the first push, at every stage.

### Negative

- The plugin's per-turn diff review sends code to the model endpoint and costs tokens on every
  turn, on a strong model by default. A project with strict data rules or a tight budget has to
  set its environment variables deliberately; nothing here sets them.
- Onboarding grows by a block of questions and a document. A small internal tool pays for a threat
  model it may barely need; the level L1 keeps it short, but it is still work.
- The linter checks that a Security section exists and is not empty, not that it is right. A
  sentence claiming "no impact" passes.
- ASVS requirements are referenced, not copied: the reviewer has to read the current standard.
  An offline reviewer falls back to the checklist, which is a summary.
- The secret scan runs over the whole history, so a secret committed once fails CI until it is
  rotated and the history rewritten or the finding allowlisted with a reason. That is intended,
  and it is disruptive the first time.
- The CI job is not a required status check until someone adds it to branch protection.

## Revisit when

A security incident or an external review finds something this chain should have caught: add the
rule or the check that would have, and record which layer missed it.

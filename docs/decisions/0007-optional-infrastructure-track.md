---
type: adr
id: "0007"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, tooling, infra]
supersedes: null
superseded_by: null
---
# 0007 - Ship infrastructure as an optional track built on specs and ADRs

## Context

Until now the template stopped at the edge of the application. `infra-setup` was a placeholder for
a deploy procedure, and a project that needed its own cloud infrastructure had nothing: no agent
that knew how to plan it, no rule about versions or state, and no guard against the one command
that does the most damage, an agent running `apply`.

That gap matters more than it looks, because infrastructure is where agent mistakes are least
reversible. A wrong line of application code is reverted by a commit. A wrong `apply` deletes a
database, and the commit that caused it reverts nothing. The same agent habits that are harmless in
application code are costly here: recalling a module version from memory produces a plan that
fails at apply time, "fixing" an expired credential by editing code produces a change nobody asked
for, and one long session that writes thirty modules drifts away from the rules it read at the
start.

The patterns that handle this come from running a multi-agent infrastructure pipeline on real
projects: a planner that resolves every version and writes a plan with fixed sections, an engineer
that builds in dependency-ordered batches and plans every component it writes, a reviewer that
walks a checklist and cannot edit what it reviews, and the human applying. That pipeline carried
its own document set and its own conventions, and some of it was specific to the organisation and
its standards. This repository is public, so none of that content can come with it; only the shape
can.

The template already has most of the primitives such a pipeline invents for itself: a spec with
acceptance criteria, a plan and a task list, decision records, a journal, a checkpoint that
survives a dead session. Adding a parallel document set for infrastructure would give a derived
project two ways to record the same decision.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Keep infrastructure out of the template | Nothing new to maintain; stack-agnostic stays simple | Every project that owns infrastructure improvises it, with no guard on `apply` | Low |
| Port the pipeline as it was, with its own plan, decisions and journal files | Proven as a whole | Two decision systems in one repository; organisation-specific content cannot be published | Medium |
| A generic track mapped onto specs, ADRs and tasks, deleted by onboarding when unused | One way to record anything; public-safe; absent from projects that do not need it | Generic rules are weaker than an organisation's own; the mapping is new and untested end to end | Low |
| A pluggable external rulebook that a private installation can supply | Organisation standards without publishing them | Couples a public template to a private repository and its install layout | Medium |

## Decision

We will ship an optional infrastructure track whose artifacts are the template's own: an
infrastructure spec holds the requirements, its `plan.md` the architect's plan, its `tasks.md` the
engineer's batches, a `review.md` beside them the reviewer's cycles, and foundation choices are
ADRs.

The track is three agents (`infra-architect`, `infra-engineer`, `infra-reviewer`), two
orchestrating skills (`infra-bootstrap` for a new tree or environment, `infra-change` for the
day-to-day, triaged into three tiers), a generic rulebook (`infra-rulebook`: Terraform or OpenTofu,
optionally Terragrunt, with a worked AWS baseline), the `/infra` entry point, and an inactive
`infra.yml.example` that runs only credential-free checks.

The track costs what the project's size warrants. At onboarding the architect advises, writing
nothing, whether the project needs its own infrastructure at all and which foundation choices to
record now even if nothing is built; `/onboard` deletes the track when the answer is a managed
platform. A bootstrap may stop after an approved plan and accepted foundation ADRs, and resume
later from them. A plan with at most `infra.lightBootstrapMaxComponents` components and two
environments runs light: no separate plan review, one engineer pass, one code review cycle.

## Consequences

### Positive

- A project that owns infrastructure starts with a plan format, a review checklist and a build
  loop instead of improvising them under deadline.
- Infrastructure decisions land where every other decision lands, so a reader has one place to
  look and the ADR gate already covers them.
- Nothing organisation-specific is published, and the template does not depend on anything
  outside itself.

### Negative

- The generic rulebook is thinner than a real organisation's standard. A project with one should
  replace sections of it, and nothing prompts that except onboarding's instruction to adapt it.
- The whole pipeline is untested end to end in this form. The agents are prompts, and until a real
  bootstrap runs through them, the mapping onto specs and tasks is a design, not a result.
- The template grows by a dozen files that most application-only projects delete on day one, which
  is onboarding work that did not exist before.
- The light path drops the plan review and the second code review, trading a check for speed on
  small trees. The threshold is a guess until real projects have gone through both paths, and a
  project just above it pays the full ceremony for one extra component.
- A foundation laid at onboarding and built weeks later has a stale plan. The refresh pass
  re-resolves versions, but nothing re-checks that the requirements still hold.
- AWS is the only worked example. A project on another cloud gets the rules without the baseline.
- Letting the architect write proposed ADRs means one more agent writes into `docs/decisions/`, a
  directory whose value depends on records being considered rather than generated.

### Follow-ups

- Run one real bootstrap through the track and record what broke, before calling it stable.
- A worked baseline for a second cloud if a project needs one.

## Revisit when

The first real bootstrap finishes. If the spec and tasks mapping fought the pipeline, give the
infrastructure track its own documents after all, and supersede this.

---
name: infra-bootstrap
description: Build infrastructure for this project from nothing, or add a whole new environment. Turns requirements into an infrastructure spec, drives infra-architect and infra-reviewer until the plan is clean and approved, has infra-engineer build it in batches, reviews the code, and hands the human a punch list before apply. Use when the user asks to set up, bootstrap or plan infrastructure and there is no IaC tree yet, or for a new environment or region.
---

# Infrastructure bootstrap

You orchestrate; the agents do the work. The pipeline communicates through files in one spec
directory, `docs/specs/NNNN-infra-<slug>/`:

| File | Written by | Holds |
|---|---|---|
| `spec.md` | you, approved by the human | the requirements, in EARS form |
| `plan.md` | `infra-architect` | the plan, per `infra-rulebook/plan-format.md` |
| `review.md` | `infra-reviewer` | findings and verdicts, every cycle appended |
| `tasks.md` | `infra-engineer` | batches, plan results, blockers: the journal and resume marker |
| `docs/decisions/NNNN-*.md` | `infra-architect` proposes, the human accepts | the foundation decisions |

**Spawn discipline.** A spawn prompt is one sentence naming the step ("Plan review, cycle 1") plus
the paths the agent needs. Never paste file contents, summaries or findings into it: every agent
reads its inputs from disk, and two copies of the same input is two sources of truth.

## Phase 0: guard and requirements

**Guard.** If an IaC tree already exists (`infra/`, or anything matching `infra.paths` in
`.claude/gates.json`) and the request is not a new environment or region, stop and route to
`infra-change`. Bootstrapping over existing infrastructure rewrites what is already deployed.

**Gather, cheaply first.** Ask the human, in one message, for the broad shape: what the
infrastructure serves, cloud and region, environments, the services they expect, and anything
existing it must connect to (accounts, networks, DNS zones, a state backend). Then read
`.claude/skills/infra-rulebook/SKILL.md` and the reference pages for the services named, so you
know which choices the rulebook already makes.

**Then interrogate the rest, one question at a time**, only about what the rulebook does not
default and the answer did not cover: network ranges, sizing per environment, DNS names, backup
retention, who may reach what, the secret manager, the budget ceiling. Do not ask what the
rulebook answers; offer its default and let the human override it.

**Write the spec** with `/spec` conventions: problem, EARS acceptance criteria that an apply can be
checked against ("The system shall run production across three availability zones", "If the
primary database fails, the system shall promote a replica within N minutes"), non-goals, out of
band (accounts, domains, quotas to request), open questions. Get it to `status: approved`. The
spec is the human-owned ground truth from here on: when an answer changes later, the spec changes
with the human's agreement, and the plan follows it, never the other way round.

## Phase 1: plan, at most two review cycles

1. Spawn `infra-architect` (Mode 1) with the spec path.
2. If it returns **BLOCKED - fundamental input missing**, put its questions to the human, update the
   spec, and spawn it again.
3. Add every ADR it proposed to `docs/INDEX.md` under Decisions (it cannot), then spawn
   `infra-reviewer` (Mode 1), cycle 1, with the spec path. Link `review.md` from the spec.
4. Any verdict other than `READY - no findings`: architect fix pass with the `review.md` path, then
   reviewer cycle 2. After cycle 2, remaining findings go to the human as they are. No third cycle.

## Gate: human approval

Present the plan's paths, the proposed ADRs and the open items. Ask for **approved**, answers or
feedback. The reply is exactly one of:

1. **"Approved", nothing new.** Mark the ADRs `accepted` (the human agreed in this conversation),
   then Phase 2.
2. **Answers to open items or new facts.** They are requirements: record them in the spec, then
   re-spawn the architect to fold them in. Re-review only if the plan changed structurally. Then
   ask again. Never start the engineer on a plan that has not absorbed the answers: the engineer
   builds from the plan, not from this conversation.
3. **Feedback that changes the design.** Architect with the feedback, reviewer again, ask again.

The question to ask yourself: does the reply contain anything the engineer would need that the
plan does not yet say? If yes, it is 2 or 3.

## Phase 2: build, one batch per spawn

Spawn `infra-engineer` (Mode B) with the spec path. After each return read `tasks.md`:

- more batches remain: spawn it again for the next;
- **design blocker**: take the question to the human or the architect, then resume the engineer;
- **environment blocker**: tell the human exactly what is wrong (credentials, tooling, network).
  You do not fix environments either. Resume once they say it is fixed;
- all done: keep the engineer's **For the human, before apply** block verbatim for the end.

## Phase 3: code review, at most two cycles

`infra-reviewer` (Mode 2), cycle 1. Any finding, blocking or not, goes back to the engineer as a
Mode A fix pass pointing at `review.md`, then cycle 2. After cycle 2, remaining findings go to the
human.

## Phase 4: finish

1. **Documents.** Update `docs/ops/environments.md` (environments, state backend, where secrets
   live, who applies), `docs/architecture/overview.md` (the infrastructure the code now builds),
   `docs/INDEX.md`, and a `docs/log.md` entry. Link the ADRs. Rename `docs/ops/_runbook.md` into
   place if it is still a stub and write the apply and rollback steps from the plan's section 7.
2. **Rulebook.** Fill section 6 (naming, tags) and the Project decisions list of
   `.claude/skills/infra-rulebook/SKILL.md` from the accepted ADRs. If the tree is not under
   `infra/`, fix `infra.paths` in `.claude/gates.json`.
3. **CI.** Offer to rename `.github/workflows/infra.yml.example` to `infra.yml`. It is an ADR-gated
   guardrail change, so it goes in the same change as a decision or with the human's agreement.
4. **Rule gaps (human gate).** Collect candidate rules from `review.md` Rule gaps, from the
   engineer's returns, and from every fix in `tasks.md` that no rule would have prevented. At most
   six, one line each, naming the file and the rule. Ask which to add, which to park, which to
   drop. Write none of them without a yes.
5. **Hand over.** Post the engineer's **For the human, before apply** block unedited. The
   bootstrap is complete; the human applies.

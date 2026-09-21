---
description: Turn docs/idea.md into a scaffolded, documented project. Asks first, builds second.
argument-hint: "[optional: path to the idea file, defaults to docs/idea.md]"
---

# Onboard this project

You are setting up a repository that will be built mostly by agents. Everything you decide here
becomes the context every future session inherits. Getting it slightly wrong is expensive and
quiet, so the order below is not negotiable: **you do not write code until phase 6.**

Idea file: `$1` if provided, otherwise `@docs/idea.md`.

Current state of the repo:

- Constitution: @AGENTS.md
- Index: @docs/INDEX.md

## Phase 0 - Resume check

Read `@.claude/onboarding.json` first, before anything else.

- `status: "completed"` - this project is already onboarded. Do not run the rest of this command.
  Say so, and ask what the user actually wants: a new spec (`/spec`), a decision (`/adr`), or a
  change to something onboarding produced.
- `status: "in-progress"` - **resume**. Skip every phase listed in `completedPhases`, read what
  those phases already wrote, and continue from the next one. Do not re-ask questions that
  `docs/product/` already answers and do not rewrite documents the user already approved. Check
  `agreedButNotWritten` for decisions that were agreed verbally before the previous session ended.
- `status: "not-started"` - run from phase 1, after the reset below.

**On a first run only**, before phase 1, clear the history this repository inherited from the
template so the new project does not start out claiming someone else's work as its own:

1. Replace `docs/log.md` with its header plus one entry: "Started from agent-project-starter",
   naming the template and today's date. The template's own entries about building the gates are
   not this project's history.
2. **Keep** `docs/decisions/0000` through the last numbered ADR. Those describe the tooling this
   project inherits and is expected to follow, so deleting them would strip the reasoning behind
   the gates that are about to start failing pull requests. New ADRs continue from the next free
   number, they do not restart at `0001`.
3. Set `"stage": "exploration"` in `.claude/gates.json`. The template ships `building`, which is
   true of the template itself and wrong for a project that does not exist yet: gates that block
   on day one fight the week when the shape is still moving. They report throughout onboarding and
   start holding when the human runs `/harden`.
4. Leave `docs/idea.md` alone. It holds the idea you are onboarding.

**After finishing each phase**, do two things:

1. Update this file: set `phase`, append to `completedPhases`, set `updatedAt` to today, and record
   anything agreed but not yet written into `agreedButNotWritten` (clearing entries once they are
   written). This is the only thing that survives a session dying mid-onboarding, so update it as
   you go, not at the end.
2. Commit, on a branch `onboard/initial-setup`, with the subject `onboard: phase N - <name>`.
   One commit per phase, not one at the end. Onboarding is the part most likely to need undoing:
   a stack choice in phase 4 that turns out wrong should not cost the product documents written in
   phase 3. To undo one phase, branch from the commit before it or revert that commit; do not
   reach for `git reset --hard`, which discards uncommitted work alongside it.

Set `status: "in-progress"` and `startedAt` when you begin phase 1, and `status: "completed"` at
the end of phase 7.

## Phase 1 - Read and reflect back

Read the idea file. Then write, in at most 15 lines:

- what you understand the product to be,
- who you think it is for,
- the three assumptions the idea depends on but does not state.

Do not ask questions yet. Reflecting back first catches the misreadings that questions would
otherwise bake in.

## Phase 2 - Interrogate

First, decide how much of this phase is needed. Read what the idea file already answers, list the
gaps out loud, and ask only about those. A document that already covers the market, the user and
the scope may leave two questions, and asking the other five wastes the user's time and teaches
them to skip this command. A single paragraph leaves most of them.

Then ask **one question at a time**, waiting for each answer. Do not batch questions into a wall of
text and do not accept vague answers to the questions you do ask.

Gaps worth closing, in roughly this order, skipping every one the idea file answers clearly:

1. Who has this problem today, and what do they do instead right now.
2. What is the smallest version a real user could use. Push for something smaller than the answer.
3. What is explicitly **not** in it. Get at least three items. This becomes `non-goals.md` and it
   is binding.
4. What would make the user call it a failure in six months.
5. Hard constraints: deadline, budget, team size, technology that must or must not be used,
   regulatory or data-residency requirements.
6. Where it runs and who operates it.
7. Does it store personal data, take payments, or need authentication. Each is a decision with
   consequences, not a checkbox.

Stop asking when the remaining unknowns would not change what you build first. Then summarize the
answers and get an explicit confirmation before moving on.

## Phase 3 - Product documents

Write, from the idea plus the answers:

- `docs/product/vision.md`
- `docs/product/scope.md`
- `docs/product/non-goals.md`
- `docs/product/personas.md`

Set `status: draft` and `last_verified` to today in each. Use the user's own words where they
were precise. Do not invent numbers, do not add market language, and where an answer was
uncertain, write that it is uncertain rather than smoothing it over.

Leave `docs/idea.md` untouched. It is the historical record.

## Phase 4 - Propose the stack, as decisions

Propose a stack. For each significant choice, present:

| Choice | Recommendation | Main alternative | Why this one here | Cost to reverse |

Cover at minimum: language and runtime, framework, persistence, hosting and deploy, auth (if
needed), testing approach, styling or UI approach (if there is a UI).

Prefer boring and reversible over interesting and sticky. Match the constraints from phase 2, not
your preference. If the team is one person, say so and pick accordingly.

**Stop here and get approval.** Present the table and wait. Do not write ADRs for choices the
human has not agreed to.

## Phase 5 - Record the decisions

For each approved choice, write an ADR in `docs/decisions/`, numbered from the **next free
number**, using
`docs/decisions/_template.md`. Follow `.claude/skills/writing-adr/SKILL.md`.

Each ADR must have a real Context section. "We chose X because it is popular" is not context; the
constraint from phase 2 that made X the right call is. Each must have honest negative
consequences.

Then update:

- `AGENTS.md`: fill the `<!-- onboard:project -->`, `<!-- onboard:principles -->`,
  `<!-- onboard:code-map -->` and `<!-- onboard:commands -->` blocks from the decisions. Keep the
  file under 200 lines. Long stack conventions go into `.claude/rules/`, not here.
- `docs/architecture/overview.md`: components, request path, boundaries, links to the ADRs.
- `docs/ops/environments.md`: environments and where secrets live.
- `.claude/rules/`: replace the placeholder rules with real path-scoped ones for the chosen stack.
- `.claude/skills/design-system/`, `infra-setup/`, `api-contract/`: fill the ones the stack
  actually needs, and **delete the ones it does not**. An empty skill is worse than no skill.

## Phase 6 - Scaffold

Only now touch code. Create the minimum that runs and proves the toolchain:

- project skeleton for the chosen stack,
- one working health endpoint or one rendered page, nothing more,
- test runner with one real passing test,
- linter and formatter configured,
- `.env.example` with every variable and a safe placeholder,
- `.github/workflows/ci.yml` extended to run install, lint, test alongside the existing doc gates.

Verify it: run install, lint, test and the dev server yourself, and show the actual output. Your
summary is not evidence.

## Phase 7 - First spec and handoff

- Cut `docs/specs/0001-<slug>/` for the first capability in `scope.md`, using the template.
  Specs do start at `0001`: unlike decisions, the template ships none.
  Acceptance criteria in EARS form. Leave `status: draft` with open questions listed.
- Update `docs/INDEX.md` so every new document is listed.
- Add the onboarding entry to `docs/log.md`: 3 to 6 bullets.
- Run `npm run check` and fix what it reports.
- Final commit for this phase on `onboard/initial-setup`. Do not push without being asked.

Finish with a short report: stack chosen, ADRs written, what runs now, what the human should look
at first, and the open questions you could not resolve. Say explicitly that gates are advisory
until they run `/harden`, and name the one condition that should trigger it: the project stops
being an experiment.

## Rules for this command

- Never skip phase 2 because the idea file "seems clear enough". It never is.
- Never write an ADR for a decision the human did not approve.
- Never install a dependency that no approved ADR covers.
- If the human gives an answer that contradicts something already written, do not overwrite it
  silently: say which document it contradicts and ask which one wins.
- Update `.claude/onboarding.json` after every phase. A resumed onboarding that starts over is
  worse than no checkpoint, because it silently discards decisions the user already made.
- In phase 5, rewrite `sourcePaths` and `manifests` in `.claude/gates.json` for the chosen stack.
  The defaults there describe common JavaScript layouts and are wrong for most other languages,
  which means the Stop hook would quietly stop noticing source changes.

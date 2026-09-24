---
type: adr
id: "0008"
status: accepted
date: 2026-09-24
deciders: [maintainers]
tags: [process, tooling, security, infra]
supersedes: null
superseded_by: null
---
# 0008 - Hold agents to their lane by hook, and refuse infrastructure mutation at every stage

## Context

A subagent's `tools:` list says which tools it may call, not what it may do with them. The template's
`code-reviewer` held `Bash`, which means it could rewrite the code it was reviewing with one `sed -i`
and still call the result a review. `test-writer` was told not to modify the implementation, in
prose, which is the layer [ADR 0001](0001-enforce-documentation-in-ci.md) already established does
not survive a long session.

The infrastructure track in [ADR 0007](0007-optional-infrastructure-track.md) makes this sharper.
Its pipeline only works if each agent owns specific files: the architect the plan, the engineer the
code and its journal, the reviewer its findings. An architect that "fixes" code directly, or a
reviewer that edits the plan to match what it found, removes exactly the separation that makes
the review worth anything, and nothing in the output would show it happened.

Separately, `permissions.deny` on `Bash(terraform apply:*)` is prefix matching on the whole command.
`cd infra && terraform apply` does not start with `terraform`, and neither does
`mise exec -- tofu destroy`. The secret guard met the same problem with `cat .env` and was solved in
a hook that reads inside the command; the same approach applies here.

The question for the infrastructure guard was stage. [ADR 0004](0004-gates-are-staged.md) makes
process gates advisory while a project is still finding its shape, and keeps the secret guard
always on because a leak is not a process question. Applying infrastructure without a human is the
same kind of thing: nothing about an early project makes it acceptable.

## Options considered

| Option | Pros | Cons | Cost to reverse |
|---|---|---|---|
| Prose in each agent's prompt | No machinery | The layer known not to hold | Low |
| Remove Bash and Write from agents that should not change things | Simple, runtime-enforced | Reviewers need to run validators and tests; engineers need to write, just not everywhere | Low |
| One scope hook per agent, profiles in `gates.json`, failing closed | Configurable per stack, tested with the other gates, one definition of what each agent may do | String matching, not a sandbox; frontmatter hooks depend on the runtime honouring them | Low |
| Infrastructure guard only at `building` and later | Consistent with the other process gates | The first apply is the most likely to go wrong and would be unguarded | Low |

## Decision

We will enforce each subagent's write paths and commands with `.claude/hooks/agent-scope.mjs`,
wired from the agent's own frontmatter and configured by profile in `agentScopes` in
`.claude/gates.json`, refusing everything when a profile is missing; and we will refuse
infrastructure `apply`, `destroy`, `import`, `refresh`, taint, force-unlock, state moves and
state-migrating `init` for every agent, at every stage, in the `pre-bash` hook.

Command parsing for both lives in one module, `scripts/commands.mjs`, for the same reason
`changed-files.mjs` exists: two guards parsing the same string differently disagree. Files that fix
the shape of the infrastructure (`infra.foundations`) join the ADR gate's triggers. Agent files
become guardrails, since a reviewer's prompt is part of what the review guarantees.

## Consequences

### Positive

- A reviewer cannot edit what it reviews, and an architect cannot write code, whatever its prompt
  drifts into. The pipeline's separation is a property, not a hope.
- The `apply` guard catches the forms a permission prefix misses, and holds on day one.
- Profiles are data: onboarding re-points the test and review commands at the chosen stack without
  touching code.

### Negative

- It is a small quote-aware tokenizer, not a shell. A command written to evade it will: an alias,
  a script file, a variable holding the subcommand. It stops drift, not intent.
- Failing closed means a typo in a profile name makes an agent refuse everything. The linter checks
  that every referenced profile exists, which catches the typo but not a profile that is wrong.
- Frontmatter hooks are a Claude Code feature. Another agent runtime reading these files gets the
  prompts without the enforcement.
- Read-only profiles are kept to named commands (`npm test`, `npm run lint:docs`, `rg`, `git diff`),
  without `find`, `sort` or a bare `npm run`, which can write. That makes them brittle: a stack
  whose test command is not on the list gets refused until onboarding updates the profile.
- Making `.claude/agents/**` a guardrail means every prompt tweak to an agent needs a decision
  record once a project is at `building`. That is deliberate for reviewers and heavy for the rest.

## Revisit when

Claude Code offers per-subagent path permissions natively. The hook becomes redundant, and a
redundant guard is one that drifts from the real one.

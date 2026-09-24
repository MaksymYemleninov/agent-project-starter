---
type: spec
id: "0001"
status: done
date: 2026-09-24
owner: maintainers
adrs: ["0015"]
ui: false
---
# 0001 - Keep derived projects verifiable

Companion documents: [plan](plan.md), [tasks](tasks.md).

## Problem

Following onboarding removes configuration that the template tests assume exists. New projects
therefore inherit failing CI. Deleted ADRs can also count as decision coverage, deleted working
files crash the suite, and missing test runners are treated as implementation failures.

## Goal

The template and an adapted project pass the same checks without carrying template history.

## Non-goals

Documentation thresholds, PR-body exemptions and changes to principle 4 belong to PR 2.
No application stack, external dependency, deployment or paid repair session is introduced.

## Acceptance criteria

1. When an agent, skill file, command, rule, stack pack, scope profile, enabled plugin or example
   workflow is unregistered or multiply owned, the manifest linter shall report the exact item.
2. When onboarding disables a track, the shared adapter shall remove its registered files,
   profiles and plugins and retain core items and selected tracks.
3. When the lifecycle test adapts a disposable project, the system shall remove registered
   template ADRs and specs, replace placeholders, run npm run check at exploration and building,
   and verify the warning baseline without recursively invoking the lifecycle test.
4. When gate mechanism tests run after supported customization, they shall use their own
   fixtures and pass independently of optional shipped profiles and source-rule placeholders.
5. If an ADR is deleted, the drift gate shall never count it as coverage and shall report a
   separate violation, even alongside a new ADR or a local skip reason.
6. Where onboarding is not completed and the deleted path is a registered template ADR, the
   drift gate shall permit its cleanup; after completion it shall reject the same deletion at
   building stage. Exploration shall report violations without blocking, as ADR 0004 requires.
7. When a tracked file is absent from the working tree, the gate test copier shall omit it.
8. If a test command cannot execute, exits 126 or 127, reports command not found, times out or
   terminates by signal, repair shall exit 3 before planning or spawning an agent.
9. If manifest paths escape the project or resolve through symlinks, the adapter shall refuse
   the operation before removing any file.

## Security

The manifest authorizes local file removal and changes agent profiles. Validate ownership and
paths before mutation; do not execute manifest strings. Deletion exceptions use the comparison
base manifest, so a newly registered record cannot excuse its own removal. No secrets, network
entry points or application data are introduced. Regression fixtures use a fake repair binary.

## Out of band

Opening the pull request requires GitHub authentication and network access.

## Open questions

No blocking questions remain; the user approved the scope and decisions in the conversation.

---
type: plan
spec: "0001"
status: approved
date: 2026-09-24
---
# 0001 - Implementation plan

## Approach

Use exact manifest ownership, validated before any adapter mutation. Share the adapter between
onboarding and lifecycle tests. Preserve gate stage semantics and keep policy changes for PR 2.
[OVERRIDE: user requirement] Register this template spec and ADR as removable inherited history.

## Files touched

| Path | Change | Risk |
|---|---|---|
| .claude/tracks.json, scripts/tracks.mjs, scripts/adapt-template.mjs | Inventory, validation, shared local adapter | medium |
| scripts/changed-files.mjs, scripts/check-adr-drift.mjs, Stop hook | Retain Git statuses; distinguish ADR deletions | medium |
| scripts/test-gates.mjs, scripts/test-derived.mjs, scripts/test-regressions.mjs | Isolated fixtures and lifecycle checks | medium |
| scripts/repair.mjs, scripts/repair-test.mjs | Refuse runner/environment failures | medium |
| scripts/lint-docs.mjs, package.json, CI | Validate manifest and run lifecycle checks | low |
| .claude/gates.json, onboarding instructions, README, docs | Register guardrails and document verified behavior | low |

## Data changes

Local manifest only; no application data migration or external service change.

## Decisions required

[ADR 0015](../../decisions/0015-share-template-track-ownership.md), accepted in this conversation.

## Test strategy

Capture red regression results on the base implementation before changing it. Exercise missing
profiles, customized rules, unstaged deletion, ADR deletion and environment failures in disposable
repositories. Use controlled fixtures for signal/timeout behavior without a ten-minute wait.
Validate full manifest coverage and unsafe paths. Run the adapted project at both gate stages,
including the mechanical warning ratchet; do not claim to execute human /harden approvals.
Run code and security review before opening the PR, at most two cycles each.

## Rollout

One pull request into main. Existing consumers opt in by copying the updated tooling together
with the manifest. No deployment; revert the PR to restore the previous template tooling.

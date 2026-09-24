#!/usr/bin/env node
/**
 * ADR drift gate.
 *
 * Fails when a change moves an architectural commitment without recording why.
 * This is what makes "decisions are written down" real rather than aspirational.
 *
 * Usage:
 *   node scripts/check-adr-drift.mjs              # against origin/main, main, or HEAD~1
 *   node scripts/check-adr-drift.mjs --base <ref> # against an explicit ref
 *   BASE_REF=<ref> node scripts/check-adr-drift.mjs
 *   SKIP_ADR_CHECK="<reason>" node scripts/check-adr-drift.mjs   # escape, reason required
 *   In CI: `No-ADR-reason: <reason>` in the pull request description, passed as PR_BODY.
 *   The escape covers coverage triggers only; a forbidden ADR deletion fails regardless.
 */
import { changedFiles, classify, loadGates, stage, blocking, adrDeletions } from './changed-files.mjs';
import { escapeReason, escapeHint } from './docs-policy.mjs';

const gates = loadGates();
const argBase = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : null;
const change = changedFiles({ base: argBase ?? process.env.BASE_REF });
const { base, files, reason } = change;
if (reason) {
  console.log(`check:adr skipped, ${reason}.`);
  process.exit(0);
}
const forbidden = adrDeletions(change);
if (forbidden.length) {
  console.error(`check:adr: ADR deletion is forbidden: ${forbidden.join(', ')}. Supersede records instead.`);
  if (blocking(gates)) process.exit(1);
}
if (files.length === 0) {
  console.log(`check:adr passed. No changes against ${base}.`);
  process.exit(0);
}

const c = classify(files, gates);
c.adrs = classify(change.changes.filter((c) => ['A', 'M'].includes(c.status)).map((c) => c.path), gates).adrs;

const triggers = [];
if (c.architecture.length) triggers.push(`architecture docs changed: ${c.architecture.join(', ')}`);
if (c.manifests.length) triggers.push(`dependency manifest changed: ${c.manifests.join(', ')}`);
if (c.nonGoals.length) triggers.push('docs/product/non-goals.md changed, which is binding');
if (c.infraFoundations.length) {
  triggers.push(`infrastructure foundation changed: ${c.infraFoundations.join(', ')}`);
}
if (c.guardrails.length) triggers.push(`a guardrail itself changed: ${c.guardrails.join(', ')}`);

if (triggers.length === 0) {
  console.log(`check:adr passed. Nothing decision-shaped changed against ${base}.`);
  process.exit(0);
}
if (c.adrs.length > 0) {
  console.log(`check:adr passed. ${triggers.length} trigger(s), covered by: ${c.adrs.join(', ')}`);
  process.exit(0);
}

// The escape is weighed only once something actually needs it, and it must say why. A label says
// that someone wanted to skip, not why, so it no longer counts (ADR 0016).
const escape = escapeReason('adr');
if (escape?.error) {
  console.error(`check:adr: ${escape.error}`);
  process.exit(blocking(gates) ? 1 : 0);
}
if (escape) {
  console.log(`check:adr: ${triggers.length} trigger(s) justified (${escape.source}): ${escape.reason}`);
  process.exit(0);
}
if (!blocking(gates)) {
  console.log(
    `check:adr is advisory at stage \`${stage(gates)}\`. It would fail on:\n${triggers.map((t) => `  - ${t}`).join('\n')}`,
  );
  process.exit(0);
}

const guardrailNote = c.guardrails.length
  ? '\nWeakening a gate to make a build pass is the failure mode this check exists to catch.\n' +
    'If the gate is genuinely wrong, that is a decision and it gets an ADR like any other.\n'
  : '';

console.error(`
check:adr failed.

${triggers.map((t) => `  - ${t}`).join('\n')}

...but no decision record was added or updated in docs/decisions/.
${guardrailNote}
Either:
  1. Write the ADR. Run /adr, or copy docs/decisions/_template.md.
  2. Or, if this genuinely does not meet the test in
     docs/decisions/0000-record-architecture-decisions.md (expensive to reverse, crosses a
     component boundary, or looks arbitrary to a newcomer), say so with a written reason:
     ${escapeHint('adr')}
     A label alone is not a reason.

Base ref: ${base}
Files considered: committed on this branch plus the working tree.
`);
process.exit(1);

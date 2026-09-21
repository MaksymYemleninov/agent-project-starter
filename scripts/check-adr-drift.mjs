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
 */
import { changedFiles, classify, loadGates, stage, blocking } from './changed-files.mjs';

const skip = process.env.SKIP_ADR_CHECK;
if (skip) {
  if (skip.trim().length < 10) {
    console.error(
      'SKIP_ADR_CHECK needs an actual reason, not a truthy value.\n' +
        'Example: SKIP_ADR_CHECK="renamed a heading, no behavior change" npm run check:adr',
    );
    process.exit(1);
  }
  console.log(`check:adr skipped by request: ${skip}`);
  console.log('Repeat this reason in the pull request description so a reviewer can disagree.');
  process.exit(0);
}

const gates = loadGates();

if (!blocking(gates)) {
  console.log(
    `check:adr is advisory at stage \`${stage(gates)}\`. Run /harden, or set \`stage\` in ` +
      '`.claude/gates.json`, once the project should start holding itself to its decisions.',
  );
  process.exit(0);
}

const argBase = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : null;

const { base, files, reason } = changedFiles({ base: argBase ?? process.env.BASE_REF });

if (reason) {
  console.log(`check:adr skipped, ${reason}.`);
  process.exit(0);
}
if (files.length === 0) {
  console.log(`check:adr passed. No changes against ${base}.`);
  process.exit(0);
}

const c = classify(files, gates);

const triggers = [];
if (c.architecture.length) triggers.push(`architecture docs changed: ${c.architecture.join(', ')}`);
if (c.manifests.length) triggers.push(`dependency manifest changed: ${c.manifests.join(', ')}`);
if (c.nonGoals.length) triggers.push('docs/product/non-goals.md changed, which is binding');
if (c.guardrails.length) triggers.push(`a guardrail itself changed: ${c.guardrails.join(', ')}`);

if (triggers.length === 0) {
  console.log(`check:adr passed. Nothing decision-shaped changed against ${base}.`);
  process.exit(0);
}
if (c.adrs.length > 0) {
  console.log(`check:adr passed. ${triggers.length} trigger(s), covered by: ${c.adrs.join(', ')}`);
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
       - in CI, add the \`no-adr-needed\` label to the pull request. A fresh repository does not
         have that label yet, so create it once:
           gh label create no-adr-needed --color 0E8A16 --description "Reason is in the PR description"
       - locally, run with SKIP_ADR_CHECK="<your reason>".

Base ref: ${base}
Files considered: committed on this branch plus the working tree.
`);
process.exit(1);

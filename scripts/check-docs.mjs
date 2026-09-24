#!/usr/bin/env node
/**
 * Documentation gate: a change of code carries its documentation, in proportion to its size.
 *
 * The rule itself lives in docs-policy.mjs and is shared with the Stop hook. This script only runs
 * it against the pull request (or the working tree locally) and applies the stage and the escape.
 *
 * Usage:
 *   node scripts/check-docs.mjs [--base <ref>]      # BASE_REF=<ref> works too
 *   SKIP_DOCS_CHECK="<reason>" node scripts/check-docs.mjs
 *   In CI: `No-docs-reason: <reason>` in the pull request description, passed as PR_BODY.
 */
import { changedFiles, loadGates, stage, blocking } from './changed-files.mjs';
import { docsGaps, escapeReason, escapeHint } from './docs-policy.mjs';

const gates = loadGates();
const argBase = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null;
const change = changedFiles({ base: argBase ?? process.env.BASE_REF });

if (change.reason) {
  console.log(`check:docs skipped, ${change.reason}.`);
  process.exit(0);
}

const gaps = docsGaps(change, gates);
if (gaps.length === 0) {
  console.log(`check:docs passed. ${change.files.length} file(s) against ${change.base}, documentation in proportion.`);
  process.exit(0);
}

const escape = escapeReason('docs');
if (escape?.error) {
  console.error(`check:docs: ${escape.error}`);
  process.exit(blocking(gates) ? 1 : 0);
}
if (escape) {
  console.log(`check:docs skipped with a reason (${escape.source}): ${escape.reason}`);
  process.exit(0);
}

const report = gaps.map((g) => `  - ${g.message}`).join('\n');
if (!blocking(gates)) {
  console.log(`check:docs is advisory at stage \`${stage(gates)}\`. It would fail on:\n${report}`);
  process.exit(0);
}
console.error(`check:docs failed.\n\n${report}\n\nWrite the documentation, or if it genuinely is not needed, ${escapeHint('docs')}`);
process.exit(1);

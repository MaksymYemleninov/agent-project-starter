#!/usr/bin/env node
/**
 * ADR drift gate.
 *
 * Fails when a change moves an architectural commitment without recording why.
 * This is the check that makes "decisions are written down" real rather than aspirational.
 *
 * Usage:
 *   node scripts/check-adr-drift.mjs              # compare against origin/main, main, or HEAD~1
 *   node scripts/check-adr-drift.mjs --base <ref> # compare against an explicit ref
 *   BASE_REF=<ref> node scripts/check-adr-drift.mjs
 */
import { execSync } from 'node:child_process';

function git(cmd, { quiet = true } = {}) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Parse `git status --porcelain` into paths.
 * The status field is two columns followed by a space, but leading whitespace is significant and
 * easy to lose, so match rather than slice. Renames appear as `old -> new`; the new path is the
 * one that matters here.
 */
function parsePorcelain(raw) {
  return (raw ?? '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^\s*\S{1,2}\s+(.*)$/);
      if (!m) return null;
      const path = m[1].includes(' -> ') ? m[1].split(' -> ').pop() : m[1];
      return path.replace(/^"|"$/g, '').trim();
    })
    .filter(Boolean);
}

if (!git('rev-parse --is-inside-work-tree')) {
  console.log('check:adr skipped, not a git repository.');
  process.exit(0);
}

const argBase = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : null;

const base =
  argBase ??
  process.env.BASE_REF ??
  ['origin/main', 'origin/master', 'main', 'master']
    .map((r) => (git(`rev-parse --verify ${r}`) ? r : null))
    .find(Boolean) ??
  (git('rev-parse --verify HEAD~1') ? 'HEAD~1' : null);

if (!base) {
  console.log('check:adr skipped, no base commit to compare against yet.');
  process.exit(0);
}

const mergeBase = git(`merge-base ${base} HEAD`) ?? base;

// Committed changes against the base, plus anything still in the working tree,
// so the check behaves the same locally and in CI.
const committed = (git(`diff --name-only ${mergeBase}...HEAD`) ?? '').split('\n');
const working = parsePorcelain(git('status --porcelain'));

const changed = [...new Set([...committed, ...working])].filter(Boolean);

if (changed.length === 0) {
  console.log(`check:adr passed. No changes against ${base}.`);
  process.exit(0);
}

const MANIFESTS =
  /^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile|composer\.json)$/;

const architecture = changed.filter((f) => /^docs\/architecture\/.+\.md$/.test(f));
const manifests = changed.filter((f) => MANIFESTS.test(f));
const adrs = changed.filter((f) => /^docs\/decisions\/\d{4}-.+\.md$/.test(f));
const nonGoals = changed.filter((f) => f === 'docs/product/non-goals.md');

const triggers = [];
if (architecture.length) triggers.push(`architecture docs changed: ${architecture.join(', ')}`);
if (manifests.length) triggers.push(`dependency manifest changed: ${manifests.join(', ')}`);
if (nonGoals.length) triggers.push('docs/product/non-goals.md changed');

if (triggers.length === 0) {
  console.log(`check:adr passed. Nothing decision-shaped changed against ${base}.`);
  process.exit(0);
}

if (adrs.length > 0) {
  console.log(`check:adr passed. ${triggers.length} trigger(s), covered by: ${adrs.join(', ')}`);
  process.exit(0);
}

console.error(`
check:adr failed.

${triggers.map((t) => `  - ${t}`).join('\n')}

...but no decision record was added or updated in docs/decisions/.

Either:
  1. Write the ADR. Run /adr, or copy docs/decisions/_template.md.
  2. Or, if this genuinely does not meet the test in
     docs/decisions/0000-record-architecture-decisions.md (expensive to reverse, crosses a
     component boundary, or looks arbitrary to a newcomer), say so in the pull request
     description and add the label \`no-adr-needed\`.

Base ref: ${base}
`);
process.exit(1);

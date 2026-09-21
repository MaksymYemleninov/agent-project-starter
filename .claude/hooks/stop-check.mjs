#!/usr/bin/env node
// Stop hook: the last line of defence before the session ends.
//
// It looks at everything the branch touches, committed and uncommitted alike, and blocks once if
// that work carries no documentation. Committing before stopping used to walk straight past this.
//
// Blocking at most once per session is deliberate: a hook that can block forever gets disabled.
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hooks may run from anywhere. Anchor to the project, or the git calls below silently see nothing.
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  process.chdir(projectDir);
} catch {
  process.exit(0);
}

const { changedFiles, classify, loadGates, blocking } = await import('./../../scripts/changed-files.mjs');
const gates = loadGates();

// At exploration stage the hook stays out of the way entirely.
if (!blocking(gates)) process.exit(0);
const tuning = gates.stopHook;

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

// Never block a stop we already caused: that is how you get a loop.
if (payload.stop_hook_active) process.exit(0);

const sessionId = String(payload.session_id ?? 'unknown').replace(/[^\w-]/g, '');
const stateDir = '.claude/.state';
const marker = join(stateDir, `stop-warned-${sessionId}`);
if (existsSync(marker)) process.exit(0);

const { files, reason } = changedFiles();
if (reason || files.length === 0) process.exit(0);

const c = classify(files, gates);
const gaps = [];

const guardrailTrigger = tuning.requireAdrForGuardrails && c.guardrails.length > 0;
if ((c.architecture.length || c.manifests.length || guardrailTrigger) && c.adrs.length === 0) {
  gaps.push(
    'Architecture, dependencies or a guardrail changed with no ADR added or updated. Either write ' +
      'one in `docs/decisions/` (use `/adr`), or state plainly why this does not meet the ADR test ' +
      'in `docs/decisions/0000-record-architecture-decisions.md`.',
  );
}

if (c.source.length >= tuning.sourceFilesWithoutSpec && c.specs.length === 0 && c.adrs.length === 0) {
  gaps.push(
    `${c.source.length} source files changed (threshold ${tuning.sourceFilesWithoutSpec}, tunable in ` +
      '`.claude/gates.json`) with no spec and no ADR touched. If this was a ' +
      'multi-step feature it should have had a spec under `docs/specs/`. Name the spec that covers ' +
      'it, or write one.',
  );
}

if (tuning.requireLogEntry && (c.source.length || c.architecture.length) && c.log.length === 0) {
  gaps.push('`docs/log.md` has no entry for this work. Add 3 to 6 bullets: what changed and where.');
}

if (gaps.length === 0) process.exit(0);

mkdirSync(stateDir, { recursive: true });
writeFileSync(marker, new Date().toISOString());

// Keep the marker directory from growing forever.
try {
  for (const name of readdirSync(stateDir)) {
    const p = join(stateDir, name);
    if (Date.now() - statSync(p).mtimeMs > 7 * 86400000) unlinkSync(p);
  }
} catch {}

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      'Documentation gate (fires once per session, then gets out of the way):\n\n' +
      gaps.map((g, i) => `${i + 1}. ${g}`).join('\n') +
      '\n\nClose these, or explain to the human why each one does not apply. Do not silently skip them.',
  }),
);
process.exit(0);

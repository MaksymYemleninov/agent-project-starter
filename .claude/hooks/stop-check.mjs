#!/usr/bin/env node
// Stop hook: the last line of defence before the session ends.
//
// It looks at what actually changed in the working tree and blocks once if the change carries
// no documentation. Blocking at most once per session is deliberate: a hook that can block
// forever is a hook someone disables.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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
const marker = `${stateDir}/stop-warned-${sessionId}`;
if (existsSync(marker)) process.exit(0);

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

if (!git('rev-parse --is-inside-work-tree')) process.exit(0);

// The status field is two columns plus a space, but leading whitespace is significant and easy
// to lose to a trim, so match rather than slice. Renames appear as `old -> new`.
const changed = (git('status --porcelain') ?? '')
  .split('\n')
  .map((line) => {
    const m = line.match(/^\s*\S{1,2}\s+(.*)$/);
    if (!m) return null;
    const path = m[1].includes(' -> ') ? m[1].split(' -> ').pop() : m[1];
    return path.replace(/^"|"$/g, '').trim();
  })
  .filter(Boolean);

if (changed.length === 0) process.exit(0);

const has = (re) => changed.some((f) => re.test(f));

const gaps = [];

const codeChanged = has(/^(src|app|lib|server|packages|api|components)\//);
const archChanged = has(/^docs\/architecture\//);
const depsChanged = has(/^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile)$/);
const adrChanged = has(/^docs\/decisions\/\d{4}-/);
const logChanged = has(/^docs\/log\.md$/);
const specChanged = has(/^docs\/specs\/\d{4}-/);

if ((archChanged || depsChanged) && !adrChanged) {
  gaps.push(
    'Architecture or dependencies changed but no ADR was added or updated. Either write one in ' +
      '`docs/decisions/` (use `/adr`) or state plainly why this change does not meet the ADR test ' +
      'in `docs/decisions/0000-record-architecture-decisions.md`.',
  );
}

if (codeChanged && !specChanged && !adrChanged && changed.filter((f) => /^(src|app|lib|server|packages|api|components)\//.test(f)).length > 2) {
  gaps.push(
    'Several source files changed with no spec and no ADR touched. If this was a multi-step ' +
      'feature it should have had a spec under `docs/specs/`. Say which spec covers it, or write one.',
  );
}

if ((codeChanged || archChanged) && !logChanged) {
  gaps.push('`docs/log.md` has no entry for this work. Add 3 to 6 bullets: what changed and where.');
}

if (gaps.length === 0) process.exit(0);

mkdirSync(stateDir, { recursive: true });
writeFileSync(marker, new Date().toISOString());

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

#!/usr/bin/env node
// SessionStart hook: puts the documentation entry point and open work in context once,
// so the agent does not have to rediscover them mid-session.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hooks may run from anywhere. Anchor to the project, or every relative path below silently
// resolves against the wrong directory and the hook goes quiet instead of failing loudly.
const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  process.chdir(projectDir);
} catch {
  process.exit(0);
}

const lines = [];

if (existsSync('docs/INDEX.md')) {
  lines.push('Documentation entry point is `docs/INDEX.md`. Read it before multi-step work.');
}

// Specs that are not finished yet.
try {
  const out = execSync(
    "grep -l '^status: \\(draft\\|approved\\|in-progress\\)' docs/specs/*/spec.md 2>/dev/null || true",
    { encoding: 'utf8' },
  ).trim();
  const open = out.split('\n').filter((l) => l && !l.includes('_template'));
  if (open.length) lines.push(`Open specs: ${open.join(', ')}`);
} catch {}

// ADRs still waiting for a decision.
try {
  const out = execSync(
    "grep -l '^status: proposed' docs/decisions/*.md 2>/dev/null || true",
    { encoding: 'utf8' },
  ).trim();
  const open = out.split('\n').filter((l) => l && !l.includes('_template'));
  if (open.length) lines.push(`Proposed ADRs awaiting a decision: ${open.join(', ')}`);
} catch {}

// Not onboarded yet.
if (existsSync('AGENTS.md') && readFileSync('AGENTS.md', 'utf8').includes('Stage: pre-onboarding')) {
  lines.push('This project has not been onboarded yet. Run `/onboard` before writing code.');
}

if (lines.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lines.join('\n'),
      },
    }),
  );
}
process.exit(0);

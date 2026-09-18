#!/usr/bin/env node
// SessionStart hook: puts the documentation entry point and open work in context once,
// so the agent does not have to rediscover them mid-session.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

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

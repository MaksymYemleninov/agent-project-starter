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

// Onboarding state. A half-finished onboarding is the case worth surfacing loudest: without this
// the next session cheerfully starts over and rewrites documents someone already agreed to.
if (existsSync('.claude/onboarding.json')) {
  try {
    const s = JSON.parse(readFileSync('.claude/onboarding.json', 'utf8'));
    if (s.status === 'in-progress') {
      lines.push(
        `Onboarding is IN PROGRESS, stopped after phase ${s.phase ?? '?'} ` +
          `(completed: ${(s.completedPhases ?? []).join(', ') || 'none'}). ` +
          'Run `/onboard` to resume from the next phase. Do not restart from phase 1 and do not ' +
          'rewrite documents that are already written.',
      );
      if (s.agreedButNotWritten?.length) {
        lines.push(`Agreed but not yet written down: ${s.agreedButNotWritten.join('; ')}`);
      }
    } else if (s.status === 'not-started') {
      lines.push('This project has not been onboarded yet. Run `/onboard` before writing code.');
    }
  } catch {
    lines.push('`.claude/onboarding.json` is unreadable. Check it before running `/onboard`.');
  }
} else if (existsSync('AGENTS.md') && readFileSync('AGENTS.md', 'utf8').includes('Stage: pre-onboarding')) {
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

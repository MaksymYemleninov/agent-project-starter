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

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {}

const lines = [];

// After compaction or a clear the conversation that knew what was in flight is gone, and the agent
// carries on from a summary that may have dropped exactly the step it was on. The repository still
// knows: put the branch, the uncommitted work and the unfinished tasks back in front of it.
if (['compact', 'clear', 'resume'].includes(payload.source)) {
  const sh = (cmd) => {
    try {
      return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  lines.push(
    `Context was ${payload.source === 'resume' ? 'resumed' : payload.source === 'clear' ? 'cleared' : 'compacted'}. ` +
      'Before continuing, re-read the spec or task you were working on; do not rely on the summary for ' +
      'what is done.',
  );
  const branch = sh('git branch --show-current');
  if (branch) lines.push(`Branch: ${branch}`);
  const { git, parsePorcelain } = await import('./../../scripts/changed-files.mjs');
  const dirty = parsePorcelain(git('status --porcelain --untracked-files=all'));
  if (dirty.length) {
    lines.push(
      `Uncommitted: ${dirty.length} file(s): ${dirty.slice(0, 12).join(', ')}` +
        (dirty.length > 12 ? ', ...' : ''),
    );
  }
  const tasks = sh(
    "grep -HE '\\|\\s*(doing|blocked)\\s*\\|' docs/specs/*/tasks.md 2>/dev/null | grep -v _template",
  )
    .split('\n')
    .filter(Boolean)
    .slice(0, 10)
    .map((l) => {
      const [file, ...row] = l.split(':');
      const cells = row.join(':').split('|').map((c) => c.trim()).filter(Boolean);
      return `${file.replace('docs/specs/', '').replace('/tasks.md', '')} #${cells[0]} ${cells[1]} (${cells.at(-1)})`;
    });
  if (tasks.length) lines.push(`Tasks in flight: ${tasks.join('; ')}`);
}

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

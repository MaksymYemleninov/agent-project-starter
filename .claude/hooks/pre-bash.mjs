#!/usr/bin/env node
// PreToolUse hook: stop shell commands that touch secret files, and commands that change real
// infrastructure.
//
// `permissions.deny` on `Read(./.env)` blocks the Read tool and nothing else, so `cat .env` walked
// straight around it. That made the deny rule look like protection while providing none. This
// closes the shell path, which is the one an agent actually reaches for.
//
// It is still not a security boundary. It stops accidents, not intent: a command can be obfuscated
// past any string match. Real containment is the sandbox and not putting production credentials on
// the machine in the first place.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  process.chdir(projectDir);
} catch {
  process.exit(0);
}

const { loadGates, globToRegExp } = await import('./../../scripts/changed-files.mjs');
const { irreversibleInfra } = await import('./../../scripts/commands.mjs');

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

if (payload.tool_name !== 'Bash') process.exit(0);
const command = String(payload.tool_input?.command ?? '');
if (!command) process.exit(0);

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
};

// Applying, destroying, importing or moving state changes something outside this repository that
// a revert does not bring back. Like the secret guard, this holds at every stage: there is no phase
// of a project where an agent applying infrastructure on its own is acceptable. Checked before the
// secret tokens so the reason given is the one that matters.
const mutation = irreversibleInfra(command);
if (mutation) {
  deny(
    `\`${mutation}\` changes real infrastructure or its state, and under AGENTS.md section 2.6 that ` +
      'is run by the human, not by an agent.\n\n' +
      'Hand it over instead: the exact command, the directory it runs in, and the summary of the ' +
      'plan it applies (what is created, changed, replaced and destroyed). If the plan shows any ' +
      'replace or destroy, say so first, in plain words.',
  );
}

const gates = loadGates();

// Pull out anything token-shaped that could be a path, then test those rather than the whole
// command string, so prose in a commit message does not trip the check.
const tokens = command
  .split(/[\s;|&()<>"']+/)
  .filter(Boolean)
  .map((t) => t.replace(/^-{1,2}[\w-]+=/, '').replace(/^\.\//, ''))
  .filter((t) => t && !t.startsWith('-'));

const allowed = (t) => gates.secretPathAllowlist.some((g) => globToRegExp(g).test(t));
const secret = (t) => gates.secretPaths.some((g) => globToRegExp(g).test(t));

const hits = [...new Set(tokens.filter((t) => secret(t) && !allowed(t)))];

if (hits.length === 0) process.exit(0);

deny(
  `This command references ${hits.map((h) => `\`${h}\``).join(', ')}, which the project treats ` +
    'as secret-bearing (`secretPaths` in `.claude/gates.json`).\n\n' +
    'Under AGENTS.md, agents never read, print or write real secret values. If you need to know ' +
    'which variables exist, read `.env.example`. If you genuinely need this command run, ask the ' +
    'human to run it themselves and paste back only what is safe to share.\n\n' +
    'If this is a false positive (a documentation file that merely mentions the name, say), say ' +
    'so and narrow the command rather than working around the check.',
);

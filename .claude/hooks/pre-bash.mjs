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
const { irreversibleInfra, parse } = await import('./../../scripts/commands.mjs');
const { existsSync } = await import('node:fs');
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

const allowed = (t) => gates.secretPathAllowlist.some((g) => globToRegExp(g).test(t));
const secret = (t) => gates.secretPaths.some((g) => globToRegExp(g).test(t));
const clean = (t) => t.replace(/^-{1,2}[\w-]+=/, '').replace(/^\.\//, '');
const hit = (t) => {
  const c = clean(t);
  return c && !c.startsWith('-') && secret(c) && !allowed(c) ? c : null;
};
// Code handed to an interpreter is read as code: every token-shaped piece of it counts, so
// `python3 -c "open('.env').read()"` is caught even though the whole snippet is one quoted word.
const pieces = (code) => code.split(/[\s;|&()<>"'`,{}\[\]]+/).filter(Boolean);

const INTERPRETERS = new Set(['sh', 'bash', 'zsh', 'python', 'python3', 'node', 'ruby', 'perl', 'deno', 'bun', 'php']);
const CODE_FLAGS = new Set(['-c', '-e', '--eval', '-p', '--print', '-r']);
// Printing a string is not reading a file; where the output goes is judged as a redirect.
const PRINTERS = new Set(['echo', 'printf']);
// Listing names shows that a file exists, not what is in it.
const LISTERS = new Set(['ls']);
// Options whose value is a file the tool loads into a process's environment, not prints.
const ENV_FILE_FLAGS = new Set(['--env-file']);
const ENV_LOADERS = new Set(['dotenv', 'dotenvx']);
const base = (w) => (w ?? '').split('/').pop();

const hits = new Set();
for (const seg of parse(command)) {
  const w = seg.words;
  for (const r of seg.redirects) {
    const target = r.replace(/^\d?[<>&]+/, '');
    const h = hit(target);
    if (h) hits.add(h);
  }
  // A substitution can run anything; read the whole segment the strict way.
  if (seg.substitution) {
    for (const word of w) for (const piece of pieces(word)) { const h = hit(piece); if (h) hits.add(h); }
    continue;
  }
  let at = 0;
  while (at < w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[at])) at++;
  if (base(w[at]) === 'npx' || base(w[at]) === 'pnpx') at++;
  const cmd = base(w[at]);
  if (PRINTERS.has(cmd) || LISTERS.has(cmd)) continue;

  // `cp .env.example .env` creates a local file from the template. Allowed only while the target
  // does not exist, so it can never overwrite, or copy out, a real secrets file.
  if ((cmd === 'cp' || cmd === 'install') && w.length - at >= 3) {
    const args = w.slice(at + 1).filter((x) => !x.startsWith('-'));
    const [src, dst] = [clean(args[0] ?? ''), clean(args[args.length - 1] ?? '')];
    if (args.length === 2 && allowed(src) && secret(dst) && !existsSync(dst)) continue;
  }

  for (let i = at + 1; i < w.length; i++) {
    const word = w[i];
    if (INTERPRETERS.has(cmd) && CODE_FLAGS.has(word) && w[i + 1] !== undefined) {
      for (const piece of pieces(w[i + 1])) { const h = hit(piece); if (h) hits.add(h); }
      i++;
      continue;
    }
    if (cmd === 'git' && (word === '-m' || word === '--message')) { i++; continue; }
    if (ENV_FILE_FLAGS.has(word) || (ENV_LOADERS.has(cmd) && (word === '-e' || word === '-f'))) { i++; continue; }
    if (/^--env-file=/.test(word)) continue;
    // A quoted word with spaces is prose (a title, a message), not a path.
    if (/\s/.test(word)) continue;
    const h = hit(word);
    if (h) hits.add(h);
  }
}

if (hits.size === 0) process.exit(0);

deny(
  `This command references ${[...hits].map((h) => `\`${h}\``).join(', ')}, which the project treats ` +
    'as secret-bearing (`secretPaths` in `.claude/gates.json`).\n\n' +
    'Under AGENTS.md, agents never read, print or write real secret values. If you need to know ' +
    'which variables exist, read `.env.example`. If you genuinely need this command run, ask the ' +
    'human to run it themselves and paste back only what is safe to share.\n\n' +
    'If this is a false positive (a documentation file that merely mentions the name, say), say ' +
    'so and narrow the command rather than working around the check.',
);

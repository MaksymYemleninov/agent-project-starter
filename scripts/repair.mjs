#!/usr/bin/env node
/**
 * Bounded repair: make one failing test pass by changing the implementation, never the test.
 *
 * An agent asked to "fix the failing test" has two ways to succeed and one of them is editing the
 * test. It also has no natural stopping point: it will try a fourth and a fifth idea, each more
 * speculative, on your money. This runs the loop with the limits outside the agent, where it
 * cannot talk its way past them:
 *
 *   - the test's exit code is the only judge, run by this script, not reported by the agent;
 *   - the test files are hashed before and checked after every attempt;
 *   - every changed file must sit inside the edit scope (`sourcePaths` by default);
 *   - the spawned `claude -p` may read, edit inside the scope, and run the test command, nothing
 *     else, with a hard dollar cap and a turn cap per attempt;
 *   - without --confirm it only reports what it would do.
 *
 * Usage:
 *   node scripts/repair.mjs --test "<command>" --test-file <path> [--test-file <path> ...]
 *     [--edit <glob> ...] [--attempts 3] [--budget 2] [--models sonnet,sonnet,opus]
 *     [--max-turns 30] [--confirm]
 *
 * Exit codes:
 *   0  repaired, or dry run
 *   1  still failing after every attempt, or the budget ran out; changes left in place for review
 *   2  bad arguments
 *   3  `claude` could not be run
 *   4  refused before starting: the test already passes, or the working tree is not clean
 *   5  safety stop: a test file changed, or a file outside the edit scope changed
 *
 * `REPAIR_CLAUDE_BIN` overrides the `claude` binary, which is how test-gates.mjs exercises this
 * without spending anything.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadGates, matchesAny, git, parsePorcelain } from './changed-files.mjs';

/* ---------------------------------------------------------------- arguments */

function parseArgs(argv) {
  const a = { testFiles: [], edit: [], attempts: 3, budget: 2, models: null, maxTurns: 30, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) usage(`${v} needs a value`);
      return argv[++i];
    };
    if (v === '--test') a.test = next();
    else if (v === '--test-file') a.testFiles.push(next());
    else if (v === '--edit') a.edit.push(next());
    else if (v === '--attempts') a.attempts = Number(next());
    else if (v === '--budget') a.budget = Number(next());
    else if (v === '--models') a.models = next().split(',').map((m) => m.trim()).filter(Boolean);
    else if (v === '--max-turns') a.maxTurns = Number(next());
    else if (v === '--confirm') a.confirm = true;
    else usage(`unknown argument ${v}`);
  }
  if (!a.test) usage('--test "<command>" is required: the command whose exit code judges the repair');
  if (!a.testFiles.length) usage('at least one --test-file is required: the files that must not change');
  if (!Number.isInteger(a.attempts) || a.attempts < 1 || a.attempts > 10) usage('--attempts must be 1 to 10');
  if (!(a.budget > 0) || a.budget > 50) usage('--budget must be a dollar amount above 0 and at most 50');
  if (!Number.isInteger(a.maxTurns) || a.maxTurns < 1) usage('--max-turns must be a positive whole number');
  // Cheap first, stronger last: the last attempt is where a harder model earns its price.
  a.models ??= a.attempts === 1 ? ['sonnet'] : [...Array(a.attempts - 1).fill('sonnet'), 'opus'];
  while (a.models.length < a.attempts) a.models.push(a.models.at(-1));
  return a;
}

function usage(msg) {
  console.error(`repair: ${msg}\n\nSee the header of scripts/repair.mjs for usage.`);
  process.exit(2);
}

/* ------------------------------------------------------------------ helpers */

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const tail = (text, n) => String(text ?? '').split('\n').slice(-n).join('\n');

function runTest(command) {
  const r = spawnSync(command, { shell: true, encoding: 'utf8', timeout: 10 * 60 * 1000 });
  return { code: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function changedSinceStart() {
  return parsePorcelain(git('status --porcelain --untracked-files=all'));
}

function report(result, code) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(code);
}

/* --------------------------------------------------------------------- main */

const args = parseArgs(process.argv.slice(2));
const gates = loadGates();
const editScope = args.edit.length ? args.edit : gates.sourcePaths;

for (const f of args.testFiles) {
  if (!existsSync(f)) usage(`test file ${f} does not exist`);
}

// A clean tree makes the result reviewable as one diff, and makes "what did the agent touch"
// answerable with certainty rather than by guessing which changes were already there.
const dirty = changedSinceStart();
if (dirty.length) {
  report(
    {
      repaired: false,
      reason: 'working-tree-not-clean',
      files: dirty,
      hint: 'Commit or stash first, so the repair is one reviewable diff and nothing of yours is mixed into it.',
    },
    4,
  );
}

// A repair of a test that already passes is a typo in the command, and would spend money fixing
// nothing. Check before spawning anything.
const before = runTest(args.test);
if (before.code === 0) {
  report(
    {
      repaired: false,
      reason: 'test-already-passes',
      hint: 'The command exits 0 now. Check that it runs the failing test, and that the test actually fails.',
    },
    4,
  );
}

const hashes = Object.fromEntries(args.testFiles.map((f) => [f, hash(f)]));

const plan = {
  test: args.test,
  failingNow: tail(before.output, 20),
  protected: args.testFiles,
  editScope,
  attempts: args.attempts,
  models: args.models.slice(0, args.attempts),
  budgetUsd: args.budget,
  perAttemptCapUsd: Number((args.budget / args.attempts).toFixed(2)),
  maxTurnsPerAttempt: args.maxTurns,
};

if (!args.confirm) {
  report({ dryRun: true, plan, next: 'Nothing was run. Add --confirm to spend up to the budget above.' }, 0);
}

const claude = process.env.REPAIR_CLAUDE_BIN ?? 'claude';
let spent = 0;
const log = [];
let last = before;

for (let attempt = 1; attempt <= args.attempts; attempt++) {
  const cap = Math.min(args.budget / args.attempts, args.budget - spent);
  if (cap <= 0.01) {
    log.push({ attempt, skipped: 'budget exhausted' });
    break;
  }

  const prompt = [
    `A test is failing. Make it pass by changing the implementation. This is attempt ${attempt} of ${args.attempts}.`,
    '',
    `Test command: ${args.test}`,
    `Test files, which you must not change and cannot: ${args.testFiles.join(', ')}`,
    `You may edit only files matching: ${editScope.join(', ')}`,
    '',
    'Current failure (last lines):',
    '```',
    tail(last.output, 120),
    '```',
    '',
    'Read the test first and treat it as the specification. Make the smallest change that makes it pass.',
    'Run the test command to check your work. Do not weaken, skip or special-case anything to satisfy it.',
    'If the test itself looks wrong, or the fix needs a file outside your scope, stop and say so in one',
    'line starting with BLOCKED:, rather than working around it.',
  ].join('\n');

  const allowed = ['Read', 'Grep', 'Glob', ...editScope.map((g) => `Edit(${g})`), `Bash(${args.test})`];
  const disallowed = ['Write', 'NotebookEdit', 'WebFetch', 'WebSearch', ...args.testFiles.map((f) => `Edit(${f})`)];

  const env = { ...process.env };
  // A nested session can refuse to start when it sees the parent's marker.
  delete env.CLAUDECODE;

  const r = spawnSync(
    claude,
    [
      '-p',
      '--output-format', 'json',
      '--model', args.models[attempt - 1],
      '--max-budget-usd', cap.toFixed(2),
      '--max-turns', String(args.maxTurns),
      '--permission-mode', 'dontAsk',
      '--allowedTools', ...allowed,
      '--disallowedTools', ...disallowed,
    ],
    { input: prompt, encoding: 'utf8', env, timeout: 30 * 60 * 1000 },
  );

  if (r.error) {
    report({ repaired: false, reason: 'claude-not-runnable', error: String(r.error.message), attempts: log }, 3);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(r.stdout || '{}');
  } catch {}
  const cost = Number(parsed.total_cost_usd ?? 0);
  spent += Number.isFinite(cost) ? cost : 0;

  // The limits that matter are checked here, by this script, whatever the agent said it did.
  const tampered = args.testFiles.filter((f) => !existsSync(f) || hash(f) !== hashes[f]);
  const outside = changedSinceStart().filter((f) => !matchesAny(f, editScope));
  if (tampered.length || outside.length) {
    report(
      {
        repaired: false,
        reason: tampered.length ? 'test-files-changed' : 'edited-outside-scope',
        tampered,
        outside,
        spentUsd: Number(spent.toFixed(4)),
        hint: 'Nothing was reverted. Inspect with `git diff`, then restore what you do not want with `git restore`.',
        attempts: log,
      },
      5,
    );
  }

  last = runTest(args.test);
  const said = String(parsed.result ?? '').trim();
  log.push({
    attempt,
    model: args.models[attempt - 1],
    claudeExit: r.status,
    costUsd: Number(cost.toFixed(4)),
    testExit: last.code,
    blocked: said.split('\n').find((l) => l.startsWith('BLOCKED:')) ?? null,
  });

  if (last.code === 0) {
    report(
      {
        repaired: true,
        changed: changedSinceStart(),
        spentUsd: Number(spent.toFixed(4)),
        attempts: log,
        next: 'Review the diff. The test passing is necessary, not sufficient: read what changed.',
      },
      0,
    );
  }
  if (log.at(-1).blocked) break;
}

report(
  {
    repaired: false,
    reason: log.at(-1)?.blocked ? 'agent-blocked' : spent >= args.budget - 0.01 ? 'budget-exhausted' : 'still-failing',
    changed: changedSinceStart(),
    failingNow: tail(last.output, 20),
    spentUsd: Number(spent.toFixed(4)),
    attempts: log,
    hint: 'Changes are left in place for review. `git restore .` discards them.',
  },
  1,
);

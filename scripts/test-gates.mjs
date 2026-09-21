#!/usr/bin/env node
/**
 * Tests for the gates themselves.
 *
 * The gates are the product of this template, and every bug found in them so far was found by
 * hand, once, and would have come back on the next edit. Each case below corresponds to a real
 * defect: the Stop hook that ignored committed work, the hooks that went silent outside the repo
 * root, the frontmatter parser that broke on CRLF, the ADR check that accepted an empty shell.
 *
 * Runs against a disposable copy, so it can mutate freely and never touches your working tree.
 */
import { execSync, execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, appendFileSync, existsSync,
  mkdirSync, copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const results = [];
let sandbox;

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: sandbox, encoding: 'utf8', stdio: 'pipe', ...opts });

/** Run a script and return its exit code rather than throwing. */
function exitCode(cmd) {
  try {
    sh(cmd);
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

/** Feed JSON to a hook on stdin, return whatever it wrote. */
function hook(name, payload, cwd = sandbox) {
  try {
    return execFileSync('node', [join(sandbox, '.claude/hooks', name)], {
      cwd,
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox },
    }).trim();
  } catch {
    return '';
  }
}

function check(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, ok, actual, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  (got ${actual}, want ${expected})`}`);
}

function setup() {
  sandbox = mkdtempSync(join(tmpdir(), 'gate-test-'));
  // Tracked files plus new ones that are not ignored: everything git would consider part of the
  // repository. `git ls-files` alone omits a file you have just created, which is exactly the file
  // a change under development consists of.
  const tracked = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  if (tracked.length === 0) throw new Error('no files found, run this inside the repository');

  // Copy the WORKING TREE, not `git archive HEAD`. Archiving HEAD tests the committed state, so a
  // change under development is tested only after it is committed, and worse, a broken edit in the
  // working tree passes against the old good code still in HEAD. A false green is the one result a
  // test suite must never produce.
  for (const file of tracked) {
    const target = join(sandbox, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, file), target);
  }

  sh('git init -q -b main');
  sh('git add -A');
  sh('git -c user.name=t -c user.email=t@t commit -q -m base');
  sh('git switch -q -c work');
}

function teardown() {
  if (sandbox && existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true });
}

const ARCH = () => join(sandbox, 'docs/architecture/overview.md');

try {
  setup();
  console.log('\nGate tests\n');

  check('lint-docs passes on a clean tree', exitCode('node scripts/lint-docs.mjs'), 0);
  check('check-adr passes on a clean tree', exitCode('node scripts/check-adr-drift.mjs'), 0);

  // The original bug: the gate only saw uncommitted work.
  appendFileSync(ARCH(), '\n- an undocumented component\n');
  check('architecture change without an ADR fails', exitCode('node scripts/check-adr-drift.mjs'), 1);
  check(
    'Stop hook blocks on uncommitted architecture change',
    hook('stop-check.mjs', { session_id: 'a' }) ? 'blocked' : 'silent',
    'blocked',
  );
  sh('git -c user.name=t -c user.email=t@t commit -qam wip');
  check('...and still fails once committed', exitCode('node scripts/check-adr-drift.mjs'), 1);
  check(
    '...and the Stop hook still blocks once committed',
    hook('stop-check.mjs', { session_id: 'b' }) ? 'blocked' : 'silent',
    'blocked',
  );
  check(
    'Stop hook stays quiet the second time in one session',
    hook('stop-check.mjs', { session_id: 'b' }) ? 'blocked' : 'silent',
    'silent',
  );
  check(
    'Stop hook never blocks a stop it caused',
    hook('stop-check.mjs', { session_id: 'c', stop_hook_active: true }) ? 'blocked' : 'silent',
    'silent',
  );
  sh('git reset -q --hard HEAD~1');
  rmSync(join(sandbox, '.claude/.state'), { recursive: true, force: true });

  // Quietly relaxing the gate that is complaining.
  const linter = join(sandbox, 'scripts/lint-docs.mjs');
  writeFileSync(linter, readFileSync(linter, 'utf8').replace('lines > 200', 'lines > 99999'));
  check('weakening a guardrail without an ADR fails', exitCode('node scripts/check-adr-drift.mjs'), 1);
  sh('git checkout -- scripts/lint-docs.mjs');

  check(
    'escape hatch rejects a reasonless skip',
    exitCode('SKIP_ADR_CHECK=1 node scripts/check-adr-drift.mjs'),
    1,
  );

  // permissions.deny on Read never covered the shell.
  const denied = (cmd) =>
    hook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: cmd } }) ? 'deny' : 'allow';
  check('secret guard denies reading .env', denied('cat .env'), 'deny');
  check('secret guard denies a private key', denied('cp ~/.ssh/id_rsa /tmp/x'), 'deny');
  check('secret guard denies it inside python', denied(`python3 -c "open('.env').read()"`), 'deny');
  check('secret guard allows .env.example', denied('cat .env.example'), 'allow');
  check('secret guard allows ordinary work', denied('npm test'), 'allow');
  check('secret guard ignores non-Bash tools', hook('pre-bash.mjs', { tool_name: 'Read' }) ? 'deny' : 'allow', 'allow');

  // An ADR that exists but records nothing.
  writeFileSync(
    join(sandbox, 'docs/decisions/0097-lazy.md'),
    ['---', 'type: adr', 'id: "0097"', 'status: accepted', 'date: 2026-09-18', 'deciders: [x]',
     'tags: [t]', 'supersedes: null', 'superseded_by: null', '---', '# 0097 - Use a database', '',
     '## Context', 'We need one.', '', '## Decision', 'Postgres.', '', '## Consequences',
     '### Negative', '- None.', ''].join('\n'),
  );
  check('an empty-shell ADR is rejected', exitCode('node scripts/lint-docs.mjs'), 1);
  rmSync(join(sandbox, 'docs/decisions/0097-lazy.md'));

  // A Windows checkout would have reported every document malformed.
  writeFileSync(
    join(sandbox, 'docs/decisions/0096-crlf.md'),
    readFileSync(join(sandbox, 'docs/decisions/0000-record-architecture-decisions.md'), 'utf8')
      .replace(/id: "0000"/, 'id: "0096"')
      .replace(/\n/g, '\r\n'),
  );
  const crlfErrors = (() => {
    try {
      sh('node scripts/lint-docs.mjs');
      return 0;
    } catch (e) {
      return (e.stdout ?? '').split('\n').filter((l) => l.includes('0096')).length;
    }
  })();
  // One error only: not listed in the index. Anything more means the frontmatter failed to parse.
  check('CRLF document parses', crlfErrors, 1);
  rmSync(join(sandbox, 'docs/decisions/0096-crlf.md'));

  // Hooks used to go silent when run from anywhere but the repository root.
  check(
    'hooks work from a subdirectory',
    hook('session-start.mjs', {}, join(sandbox, 'docs')) ? 'ok' : 'silent',
    'ok',
  );

  check('tree is green again', exitCode('node scripts/lint-docs.mjs'), 0);

  // The shipped config must declare its stage rather than inherit the code's default. This key
  // went missing once and every check stayed green.
  const shipped = JSON.parse(readFileSync(join(sandbox, '.claude/gates.json'), 'utf8'));
  check('shipped gates.json declares a stage', 'stage' in shipped, true);

  const withoutStage = { ...shipped };
  delete withoutStage.stage;
  writeFileSync(join(sandbox, '.claude/gates.json'), JSON.stringify(withoutStage, null, 2));
  check('gates.json without a stage is rejected', exitCode('node scripts/lint-docs.mjs'), 1);

  writeFileSync(join(sandbox, '.claude/gates.json'), JSON.stringify({ ...shipped, sourcePaths: [] }, null, 2));
  check('an empty sourcePaths is rejected', exitCode('node scripts/lint-docs.mjs'), 1);
  sh('git checkout -- .claude/gates.json');

  // Staged gates: at exploration the checks report and block nothing, except the secret guard.
  const gatesPath = join(sandbox, '.claude/gates.json');
  const gatesJson = JSON.parse(readFileSync(gatesPath, 'utf8'));
  writeFileSync(gatesPath, JSON.stringify({ ...gatesJson, stage: 'exploration' }, null, 2));

  appendFileSync(ARCH(), '\n- another undocumented component\n');
  check('exploration: drift gate does not block', exitCode('node scripts/check-adr-drift.mjs'), 0);
  check(
    'exploration: Stop hook stays silent',
    hook('stop-check.mjs', { session_id: 'expl' }) ? 'blocked' : 'silent',
    'silent',
  );
  writeFileSync(
    join(sandbox, 'docs/decisions/0095-lazy.md'),
    ['---', 'type: adr', 'id: "0095"', 'status: accepted', 'date: 2026-09-21', 'deciders: [x]',
     'tags: [t]', 'supersedes: null', 'superseded_by: null', '---', '# 0095 - Thing', '',
     '## Context', 'Short.', '', '## Decision', 'Yes.', '', '## Consequences',
     '### Negative', '- No.', ''].join('\n'),
  );
  check('exploration: lint reports but does not fail', exitCode('node scripts/lint-docs.mjs'), 0);
  check(
    'exploration: secret guard still denies',
    hook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: 'cat .env' } }) ? 'deny' : 'allow',
    'deny',
  );

  writeFileSync(gatesPath, JSON.stringify({ ...gatesJson, stage: 'building' }, null, 2));
  check('building: lint fails again on the same tree', exitCode('node scripts/lint-docs.mjs'), 1);
  rmSync(join(sandbox, 'docs/decisions/0095-lazy.md'));
  sh('git checkout -- docs/architecture/overview.md .claude/gates.json');
} finally {
  teardown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed\n`);
process.exit(failed.length ? 1 : 0);

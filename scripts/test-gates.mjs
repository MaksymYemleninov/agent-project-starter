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
function hook(name, payload, cwd = sandbox, args = []) {
  try {
    return execFileSync('node', [join(sandbox, '.claude/hooks', name), ...args], {
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

  // Force `building` as the baseline. The blocking assertions below are about what the gates do
  // when they hold. A project derived from this template sits at `exploration`, where the gates
  // deliberately report and exit 0, so inheriting the host project's stage made all eight blocking
  // cases fail the first time this suite ran inside a real derived project.
  const gatesFile = join(sandbox, '.claude/gates.json');
  if (existsSync(gatesFile)) {
    const g = JSON.parse(readFileSync(gatesFile, 'utf8'));
    writeFileSync(gatesFile, JSON.stringify({ ...g, stage: 'building' }, null, 2));
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

  // Prefix-matching permission rules miss `cd infra && terraform apply`. The hook reads inside.
  check('infra guard denies apply', denied('terraform apply'), 'deny');
  check('infra guard denies apply behind cd', denied('cd infra/envs/prod && terraform apply -auto-approve'), 'deny');
  check('infra guard denies destroy through a runner', denied('mise exec -- tofu destroy'), 'deny');
  check('infra guard denies terragrunt run --all apply', denied('terragrunt run --all -- apply'), 'deny');
  check('infra guard denies moving state', denied('terraform state rm aws_s3_bucket.logs'), 'deny');
  check('infra guard allows plan, even plan -destroy', denied('cd infra && terraform plan -destroy'), 'allow');
  check('infra guard ignores prose in a commit message', denied('git commit -m "never run terraform apply"'), 'allow');
  check('infra guard reads through a subshell', denied('(cd infra && terraform apply)'), 'deny');
  check('infra guard reads through env and timeout', denied('env TF_LOG=debug timeout 600 terraform apply'), 'deny');
  check('infra guard reads through aws-vault', denied('aws-vault exec dev terraform apply'), 'deny');
  check('infra guard reads inside sh -c', denied('sh -c "tofu destroy"'), 'deny');
  check('infra guard knows the old terragrunt names', denied('terragrunt apply-all'), 'deny');
  check('infra guard ignores operators inside quotes', denied('git commit -m "notes; terraform import is manual"'), 'allow');
  check('secret guard denies reading state', denied('cat infra/terraform.tfstate'), 'deny');

  // Each agent stays in its lane. The profile lives in gates.json; a missing one refuses all.
  const scoped = (profile, tool, input) =>
    hook('agent-scope.mjs', { tool_name: tool, tool_input: input }, sandbox, [profile]) ? 'deny' : 'allow';
  check('engineer may write infrastructure code', scoped('infra-engineer', 'Write', { file_path: 'infra/envs/prod/main.tf' }), 'allow');
  check('engineer may not write product docs', scoped('infra-engineer', 'Write', { file_path: 'docs/product/vision.md' }), 'deny');
  check('engineer may not write outside the project', scoped('infra-engineer', 'Write', { file_path: '/tmp/x.tf' }), 'deny');
  check('engineer may plan behind cd', scoped('infra-engineer', 'Bash', { command: 'cd infra/envs/prod && terraform plan' }), 'allow');
  check('engineer may not chain', scoped('infra-engineer', 'Bash', { command: 'terraform plan && terraform fmt' }), 'deny');
  check('reviewer may write only its review', scoped('infra-reviewer', 'Write', { file_path: 'docs/specs/0002-net/review.md' }), 'allow');
  check('reviewer may not edit the code it reviews', scoped('infra-reviewer', 'Edit', { file_path: 'infra/envs/prod/main.tf' }), 'deny');
  check('reviewer may not reformat, only check', scoped('infra-reviewer', 'Bash', { command: 'terraform fmt -recursive' }), 'deny');
  check('code-reviewer may pipe read-only commands', scoped('code-reviewer', 'Bash', { command: 'git diff | head -50' }), 'allow');
  check('code-reviewer may not redirect into a file', scoped('code-reviewer', 'Bash', { command: 'git diff > notes.txt' }), 'deny');
  check('code-reviewer may not sed -i', scoped('code-reviewer', 'Bash', { command: "sed -i 's/a/b/' src/x.js" }), 'deny');
  check('quoted pipes are not pipes', scoped('code-reviewer', 'Bash', { command: 'rg -n "foo|bar" scripts 2>/dev/null' }), 'allow');
  check('read-only profiles cannot find -delete', scoped('code-reviewer', 'Bash', { command: 'find . -name x -delete' }), 'deny');
  check('architect may propose a new ADR', scoped('infra-architect', 'Write', { file_path: 'docs/decisions/0099-state-backend.md' }), 'allow');
  check('architect may not rewrite an accepted ADR', scoped('infra-architect', 'Write', { file_path: 'docs/decisions/0000-record-architecture-decisions.md' }), 'deny');
  check('an unknown profile refuses everything', scoped('nobody', 'Bash', { command: 'ls' }), 'deny');
  check('scope hook ignores read-only tools', scoped('code-reviewer', 'Read', { file_path: 'src/x.js' }), 'allow');

  // An agent pointing at a profile gates.json does not define is refused everything at runtime,
  // silently. The linter is where that becomes visible.
  {
    const agent = join(sandbox, '.claude/agents/code-reviewer.md');
    const original = readFileSync(agent, 'utf8');
    writeFileSync(agent, original.replace('agent-scope.mjs\\" code-reviewer', 'agent-scope.mjs\\" code-reveiwer'));
    check('agent with an undefined scope profile fails lint', exitCode('node scripts/lint-docs.mjs'), 1);
    writeFileSync(agent, original);
  }

  // Editing a module is a change; moving a foundation is a decision.
  mkdirSync(join(sandbox, 'infra/modules/net'), { recursive: true });
  writeFileSync(join(sandbox, 'infra/modules/net/main.tf'), 'resource "null_resource" "x" {}\n');
  check('infra module change alone passes the ADR gate', exitCode('node scripts/check-adr-drift.mjs'), 0);
  mkdirSync(join(sandbox, 'infra/envs/prod'), { recursive: true });
  writeFileSync(join(sandbox, 'infra/envs/prod/backend.tf'), 'terraform {\n  backend "s3" {}\n}\n');
  check('infra foundation change without an ADR fails', exitCode('node scripts/check-adr-drift.mjs'), 1);
  rmSync(join(sandbox, 'infra'), { recursive: true, force: true });

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

  // A fix that must stay: removing its marker fails lint, naming why it mattered.
  {
    const file = join(sandbox, 'scripts/changed-files.mjs');
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, original.replace(/--untracked-files=all/g, ''));
    let out = '';
    try {
      out = sh('node scripts/lint-docs.mjs');
    } catch (e) {
      out = e.stdout ?? '';
    }
    check('removing a guarded fix fails lint', out.includes('marker `untracked-dirs-expanded` is gone'), true);
    writeFileSync(file, original);
  }

  // Each supersede link can be consistent while the chain loops, leaving nothing in force.
  {
    const adr = (id, by, sup) =>
      ['---', 'type: adr', `id: "${id}"`, 'status: superseded', 'date: 2026-09-24', 'deciders: [x]', 'tags: [t]',
       `supersedes: "${sup}"`, `superseded_by: "${by}"`, '---', `# ${id} - Loop`, '', '## Context', 'x'.repeat(220), '',
       '## Options considered', '| Option | Pros |', '|---|---|', '| A | a |', '| B | b |', '', '## Decision',
       'We will loop, which is the point of this fixture.', '', '## Consequences', '### Negative',
       '- Nothing in the chain is in force, which the linter must catch.', ''].join('\n');
    writeFileSync(join(sandbox, 'docs/decisions/0091-loop-a.md'), adr('0091', '0092', '0092'));
    writeFileSync(join(sandbox, 'docs/decisions/0092-loop-b.md'), adr('0092', '0091', '0091'));
    let out = '';
    try {
      out = sh('node scripts/lint-docs.mjs');
    } catch (e) {
      out = e.stdout ?? '';
    }
    check('a supersede cycle fails lint', out.includes('loops back on itself'), true);
    rmSync(join(sandbox, 'docs/decisions/0091-loop-a.md'));
    rmSync(join(sandbox, 'docs/decisions/0092-loop-b.md'));
  }

  // Warnings may fall below the baseline, never rise above it, and the update never raises it.
  {
    const base = join(sandbox, '.claude/lint-baseline.json');
    sh('node scripts/lint-docs.mjs --update-baseline');
    const created = JSON.parse(readFileSync(base, 'utf8')).warnings;
    check('update-baseline creates the baseline', Number.isInteger(created), true);
    check('lint passes at the baseline', exitCode('node scripts/lint-docs.mjs'), 0);
    writeFileSync(base, JSON.stringify({ warnings: created - 1 }));
    check('lint fails when warnings rise above the baseline', exitCode('node scripts/lint-docs.mjs'), 1);
    sh('node scripts/lint-docs.mjs --update-baseline || true');
    check('update-baseline never raises it', JSON.parse(readFileSync(base, 'utf8')).warnings, created - 1);
    writeFileSync(base, JSON.stringify({ warnings: created + 3 }));
    sh('node scripts/lint-docs.mjs --update-baseline');
    check('update-baseline lowers it after a cleanup', JSON.parse(readFileSync(base, 'utf8')).warnings, created);
    rmSync(base);
  }

  // After compaction the agent gets back the branch and the tasks in flight.
  {
    mkdirSync(join(sandbox, 'docs/specs/0001-demo'), { recursive: true });
    writeFileSync(
      join(sandbox, 'docs/specs/0001-demo/tasks.md'),
      '| # | Task | Depends on | Done when | Status |\n|---|---|---|---|---|\n| 3 | Wire the API | 2 | green | doing |\n',
    );
    const out = hook('session-start.mjs', { source: 'compact' });
    check('after compaction, tasks in flight are restored', out.includes('0001-demo #3 Wire the API (doing)'), true);
    check('after compaction, the branch is restored', out.includes('Branch: work'), true);
    check('a normal start does not claim a compaction', hook('session-start.mjs', { source: 'startup' }).includes('compacted'), false);
    rmSync(join(sandbox, 'docs/specs/0001-demo'), { recursive: true, force: true });
  }

  // The repair loop, against a fake `claude` that behaves as told. Nothing real is spent.
  {
    mkdirSync(join(sandbox, 'src'), { recursive: true });
    mkdirSync(join(sandbox, 'tests'), { recursive: true });
    writeFileSync(join(sandbox, 'src/sum.mjs'), 'export const sum = (a, b) => a - b;\n');
    writeFileSync(
      join(sandbox, 'tests/sum.test.mjs'),
      "import { sum } from '../src/sum.mjs';\nif (sum(2, 3) !== 5) { console.error('sum(2, 3) is ' + sum(2, 3)); process.exit(1); }\n",
    );
    const fake = join(sandbox, 'fake-claude.mjs');
    writeFileSync(
      fake,
      [
        "import { writeFileSync, readFileSync } from 'node:fs';",
        "const mode = process.env.FAKE_MODE;",
        "readFileSync(0, 'utf8');",
        "if (mode === 'fix') writeFileSync('src/sum.mjs', 'export const sum = (a, b) => a + b;\\n');",
        "if (mode === 'tamper') writeFileSync('tests/sum.test.mjs', 'process.exit(0);\\n');",
        "if (mode === 'outside') writeFileSync('README.md', 'rewritten\\n');",
        "console.log(JSON.stringify({ result: mode === 'blocked' ? 'BLOCKED: test looks wrong' : 'done', total_cost_usd: 0.05 }));",
      ].join('\n'),
    );
    // The script spawns one binary; a wrapper runs the fake through node.
    writeFileSync(join(sandbox, 'fake-claude.sh'), `#!/bin/sh\nexec node "${fake}" "$@"\n`, { mode: 0o755 });
    const run = (mode, extra) => {
      const r = (() => {
        try {
          return {
            code: 0,
            out: execSync(`node scripts/repair.mjs --test "node tests/sum.test.mjs" --test-file tests/sum.test.mjs ${extra ?? '--confirm'}`, {
              cwd: sandbox, encoding: 'utf8', stdio: 'pipe',
              env: { ...process.env, REPAIR_CLAUDE_BIN: join(sandbox, 'fake-claude.sh'), FAKE_MODE: mode },
            }),
          };
        } catch (e) {
          return { code: e.status, out: e.stdout ?? '' };
        }
      })();
      sh('git checkout -q -- . && git clean -fdq -e fake-claude.sh -e fake-claude.mjs');
      return r;
    };
    sh('git add -A && git -c user.name=t -c user.email=t@t commit -qm fake-claude');

    const dry = run('fix', '');
    check('repair without --confirm is a dry run', dry.code === 0 && dry.out.includes('"dryRun": true'), true);
    const fixed = run('fix');
    check('repair succeeds when the implementation is fixed', fixed.code === 0 && fixed.out.includes('"repaired": true'), true);
    check('repair stops when the agent edits the test', run('tamper').code, 5);
    check('repair stops when the agent edits outside its scope', run('outside').code, 5);
    check('repair gives up after its attempts, changes kept', run('nothing', '--confirm --attempts 2').code, 1);
    check('repair stops early when the agent reports BLOCKED', run('blocked').out.includes('agent-blocked'), true);

    writeFileSync(join(sandbox, 'src/sum.mjs'), 'export const sum = (a, b) => a + b;\n');
    sh('git -c user.name=t -c user.email=t@t commit -qam green');
    check('repair refuses a test that already passes', run('fix').code, 4);
    writeFileSync(join(sandbox, 'src/sum.mjs'), 'export const sum = () => 0;\n');
    let dirtyCode;
    try {
      execSync('node scripts/repair.mjs --test "node tests/sum.test.mjs" --test-file tests/sum.test.mjs', { cwd: sandbox, stdio: 'pipe' });
      dirtyCode = 0;
    } catch (e) {
      dirtyCode = e.status;
    }
    check('repair refuses a dirty working tree', dirtyCode, 4);
    sh('git checkout -q -- .');
  }

  // Security is part of every approved spec.
  {
    const dir = join(sandbox, 'docs/specs/0003-login');
    mkdirSync(dir, { recursive: true });
    const spec = (security) =>
      ['---', 'type: spec', 'id: "0003"', 'status: approved', 'date: 2026-09-24', 'owner: x', 'adrs: []', '---',
       '# 0003 - Login', '', 'Companion documents: [plan](plan.md), [tasks](tasks.md).', '', '## Acceptance criteria', '',
       '1. When a user submits valid credentials, the system shall start a session.', '',
       ...(security === null ? [] : ['## Security', '', security, '']), '## Open questions', '', '- [x] none', ''].join('\n');
    writeFileSync(join(dir, 'plan.md'), '---\ntype: plan\n---\n# plan\n');
    writeFileSync(join(dir, 'tasks.md'), '---\ntype: tasks\n---\n# tasks\n');
    appendFileSync(join(sandbox, 'docs/INDEX.md'), '\n- [Login](specs/0003-login/spec.md)\n');
    const lintOut = () => {
      try {
        return sh('node scripts/lint-docs.mjs');
      } catch (e) {
        return e.stdout ?? '';
      }
    };
    writeFileSync(join(dir, 'spec.md'), spec(null));
    check('an approved spec without a Security section fails', lintOut().includes('no `## Security` section'), true);
    writeFileSync(join(dir, 'spec.md'), spec(''));
    check('an approved spec with an empty Security section fails', lintOut().includes('`## Security` is empty'), true);
    writeFileSync(join(dir, 'spec.md'), spec('New public entry point POST /login; abuse case: brute force, see criterion 2.'));
    check('an approved spec with its Security stated passes', lintOut().includes('0003-login/spec.md'), false);
    rmSync(dir, { recursive: true, force: true });
    sh('git checkout -- docs/INDEX.md');
  }

  // The security reviewer reads and scans, and cannot change anything.
  check('security-reviewer may run a scanner', scoped('security-reviewer', 'Bash', { command: 'semgrep scan --config p/default --metrics=off' }), 'allow');
  check('security-reviewer may not write', scoped('security-reviewer', 'Write', { file_path: 'src/auth.ts' }), 'deny');
  check('security-reviewer may not run the build', scoped('security-reviewer', 'Bash', { command: 'npm run build' }), 'deny');

  // The plugin cuts its project rules at 8 KB without saying so.
  {
    const guidance = join(sandbox, '.claude/claude-security-guidance.md');
    const original = readFileSync(guidance, 'utf8');
    writeFileSync(guidance, original + '- rule\n'.repeat(1500));
    check('oversized security guidance warns', sh('node scripts/lint-docs.mjs || true').includes('truncates past 8192'), true);
    writeFileSync(guidance, original);
  }

  // After onboarding, a placeholder rule is a standard nobody wrote.
  {
    const ob = join(sandbox, '.claude/onboarding.json');
    const original = readFileSync(ob, 'utf8');
    writeFileSync(ob, JSON.stringify({ ...JSON.parse(original), status: 'completed', phase: 7 }));
    check('placeholder rules warn once onboarding is complete', sh('node scripts/lint-docs.mjs || true').includes('rules/source.md: still a placeholder after onboarding'), true);
    writeFileSync(ob, original);
    check('placeholder rules are expected before onboarding', sh('node scripts/lint-docs.mjs || true').includes('still a placeholder after onboarding'), false);
  }

  // Template stubs are ignored entirely: a leading underscore means a starting shape, not a
  // document this project has. Without this the stubs would fail every check a document must pass.
  writeFileSync(join(sandbox, 'docs/_scratch.md'), 'no frontmatter, not in the index, on purpose\n');
  check('a stub is ignored by the linter', exitCode('node scripts/lint-docs.mjs'), 0);
  rmSync(join(sandbox, 'docs/_scratch.md'));

  writeFileSync(join(sandbox, 'docs/not-a-stub.md'), 'no frontmatter, not in the index\n');
  check('a non-stub with the same content is not', exitCode('node scripts/lint-docs.mjs'), 1);
  rmSync(join(sandbox, 'docs/not-a-stub.md'));

  // A sourcePaths list that matches nothing gates nothing. It warns rather than fails, because it
  // is the expected state of a project that has no code yet.
  {
    const g = JSON.parse(readFileSync(join(sandbox, '.claude/gates.json'), 'utf8'));
    writeFileSync(
      join(sandbox, '.claude/gates.json'),
      JSON.stringify({ ...g, sourcePaths: ['nowhere/**'] }, null, 2),
    );
    let out = '';
    try {
      out = sh('node scripts/lint-docs.mjs');
    } catch (e) {
      out = e.stdout ?? '';
    }
    check('dead sourcePaths warns', out.includes('matches no file in this repository'), true);
    check('dead sourcePaths does not fail', exitCode('node scripts/lint-docs.mjs'), 0);
    sh('git checkout -- .claude/gates.json');
  }

  // The shipped config must declare its stage rather than inherit the code's default. This key
  // went missing once and every check stayed green.
  const shipped = JSON.parse(readFileSync(join(sandbox, '.claude/gates.json'), 'utf8'));
  check('shipped gates.json declares a stage', 'stage' in shipped, true);

  const withoutStage = { ...shipped };
  delete withoutStage.stage;
  writeFileSync(join(sandbox, '.claude/gates.json'), JSON.stringify(withoutStage, null, 2));
  check('gates.json without a stage is rejected', exitCode('node scripts/lint-docs.mjs'), 1);

  writeFileSync(
    join(sandbox, '.claude/gates.json'),
    JSON.stringify({ ...shipped, infra: { ...shipped.infra, lightBootstrapMaxComponents: 'few' } }, null, 2),
  );
  check('a non-numeric light threshold is rejected', exitCode('node scripts/lint-docs.mjs'), 1);

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
    'exploration: infra guard still denies apply',
    hook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: 'terraform apply' } }) ? 'deny' : 'allow',
    'deny',
  );
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

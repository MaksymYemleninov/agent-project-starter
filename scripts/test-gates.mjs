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
import { configureGateFixture } from './gate-fixture.mjs';

// The caller's escape hatches must not reach the gates under test. `SKIP_ADR_CHECK` set for the
// caller's own change made every "fails without an ADR" case pass vacuously, and `BASE_REF` would
// point the sandbox at a commit it does not have.
for (const key of ['SKIP_ADR_CHECK', 'SKIP_DOCS_CHECK', 'PR_BODY', 'BASE_REF']) delete process.env[key];

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
function hook(name, payload, cwd = sandbox, args = [], env = {}) {
  try {
    return execFileSync('node', [join(sandbox, '.claude/hooks', name), ...args], {
      cwd,
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox, ...env },
    }).trim();
  } catch (e) {
    throw new Error(`Hook ${name} failed instead of returning a decision: ${e.stderr ?? e.message}`);
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
  const tracked = execSync('git ls-files -z --cached --others --exclude-standard', {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  if (tracked.length === 0) throw new Error('no files found, run this inside the repository');

  // Copy the WORKING TREE, not `git archive HEAD`. Archiving HEAD tests the committed state, so a
  // change under development is tested only after it is committed, and worse, a broken edit in the
  // working tree passes against the old good code still in HEAD. A false green is the one result a
  // test suite must never produce.
  for (const file of new Set(tracked)) {
    if (!existsSync(join(ROOT, file))) continue;
    const target = join(sandbox, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, file), target);
  }

  configureGateFixture(sandbox); // stage: 'building', independent of host profiles and warning baseline

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

  appendFileSync(ARCH(), '\n- a component that needs a reason\n');
  check(
    'escape hatch rejects a reasonless skip',
    exitCode('SKIP_ADR_CHECK=1 node scripts/check-adr-drift.mjs'),
    1,
  );
  sh('git checkout -- docs/architecture/overview.md');

  // Documentation in proportion to the change, and escapes that carry a reason (spec 0002).
  {
    const run = (cmd, env = {}) => {
      try {
        return { code: 0, out: execSync(cmd, { cwd: sandbox, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...env } }) };
      } catch (e) {
        return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
      }
    };
    const commitAll = (msg) => sh(`git add -A && git -c user.name=t -c user.email=t@t commit -qm "${msg}"`);
    const reset = () => sh('git checkout -q -- . && git clean -fdq -- src docs/specs');
    mkdirSync(join(sandbox, 'src'), { recursive: true });
    for (const n of ['a', 'b', 'c', 'd']) writeFileSync(join(sandbox, `src/${n}.mjs`), `export const ${n} = 1;\n`);
    commitAll('docs gate base');
    sh('git branch -f main HEAD');
    const docs = (env) => run('node scripts/check-docs.mjs', env);
    const edit3 = () => { for (const n of ['a', 'b', 'c']) appendFileSync(join(sandbox, `src/${n}.mjs`), '// changed\n'); };

    appendFileSync(join(sandbox, 'src/a.mjs'), '// typo fixed\n');
    check('docs gate: one edited source file needs nothing', docs().code, 0);
    writeFileSync(join(sandbox, 'src/e.mjs'), 'export const e = 1;\n');
    check('docs gate: a new source file without a log entry fails', docs().code, 1);
    appendFileSync(join(sandbox, 'docs/log.md'), '\n- fixture entry\n');
    check('docs gate: ...and passes with one', docs().code, 0);
    reset();

    edit3();
    check('docs gate: the threshold without a spec fails', docs().code, 1);
    appendFileSync(join(sandbox, 'docs/log.md'), '\n- fixture entry\n');
    check('docs gate: ...and a log entry alone is not enough', docs().code, 1);
    mkdirSync(join(sandbox, 'docs/specs/0099-fixture'), { recursive: true });
    writeFileSync(join(sandbox, 'docs/specs/0099-fixture/junk.txt'), 'not a spec\n');
    check('docs gate: ...a stray file in a spec directory is not a spec', docs().code, 1);
    writeFileSync(join(sandbox, 'docs/specs/0099-fixture/spec.md'), '# fixture\n');
    check('docs gate: ...a spec and a log entry pass it', docs().code, 0);
    reset();

    edit3();
    appendFileSync(join(sandbox, 'docs/decisions/0000-record-architecture-decisions.md'), '\n');
    check('docs gate: the threshold with an ADR modified but no log entry fails', docs().code, 1);
    appendFileSync(join(sandbox, 'docs/log.md'), '\n- fixture entry\n');
    check('docs gate: ...an ADR and a log entry pass it', docs().code, 0);
    reset();

    sh('git mv src/a.mjs src/renamed.mjs');
    check('docs gate: moving a file is not new code', docs().code, 0);
    appendFileSync(join(sandbox, 'src/renamed.mjs'), 'export const rewritten = 2;\n');
    check('docs gate: ...but a file changed while moved is', docs().code, 1);
    reset();
    sh('git reset -q --hard');
    sh('git reset -q --hard');
    for (const n of ['a', 'b', 'c']) rmSync(join(sandbox, `src/${n}.mjs`));
    check('docs gate: deleting dead code needs no spec', docs().code, 0);
    sh('git checkout -q -- src');

    edit3();
    const why = 'mechanical rename across three files, no behaviour change';
    {
      const r = docs({ PR_BODY: `Intro\n\nNo-docs-reason: ${why}\n` });
      check('docs gate: a reason line in the PR description passes', r.code, 0);
      check('docs gate: ...and prints the reason', r.out.includes(why), true);
    }
    check('docs gate: a reason hidden in a comment is no reason', docs({ PR_BODY: `<!--\nNo-docs-reason: ${why}\n-->` }).code, 1);
    check('docs gate: the template line then a real reason passes', docs({ PR_BODY: `No-docs-reason: <!-- why -->\n\nNo-docs-reason: ${why}` }).code, 0);
    check('docs gate: twenty dots are not a reason', docs({ PR_BODY: `No-docs-reason: ${'.'.repeat(24)}` }).code, 1);
    check('docs gate: a short local reason fails', docs({ SKIP_DOCS_CHECK: 'typo' }).code, 1);
    check('docs gate: a short reason fails', docs({ PR_BODY: 'No-docs-reason: typo' }).code, 1);
    check('docs gate: the template line left empty is no reason', docs({ PR_BODY: 'No-docs-reason: <!-- why -->' }).code, 1);
    check('docs gate: a local reason passes', docs({ SKIP_DOCS_CHECK: why }).code, 0);
    check(
      'docs gate: a reason shown in fenced code is an example, not a reason',
      docs({ PR_BODY: `Syntax:\n\n\`\`\`\nNo-docs-reason: ${why}\n\`\`\`\n` }).code,
      1,
    );
    check(
      'docs gate: ...a reason after the fence still counts',
      docs({ PR_BODY: `\`\`\`\nexample\n\`\`\`\n\nNo-docs-reason: ${why}\n` }).code,
      0,
    );
    check(
      'docs gate: the Stop hook says a short local reason was rejected',
      hook('stop-check.mjs', { session_id: 'docs-short' }, sandbox, [], { SKIP_DOCS_CHECK: 'typo' }).includes('needs a reason'),
      true,
    );
    rmSync(join(sandbox, '.claude/.state'), { recursive: true, force: true });
    check(
      'docs gate: the Stop hook reports the same gap',
      hook('stop-check.mjs', { session_id: 'docs-agree' }).includes('with no spec and no ADR added or modified'),
      true,
    );
    rmSync(join(sandbox, '.claude/.state'), { recursive: true, force: true });
    check(
      'docs gate: the Stop hook accepts the same local reason',
      hook('stop-check.mjs', { session_id: 'docs-escape' }, sandbox, [], { SKIP_DOCS_CHECK: why }).includes('no spec and no ADR'),
      false,
    );
    rmSync(join(sandbox, '.claude/.state'), { recursive: true, force: true });
    {
      const gatesFile = join(sandbox, '.claude/gates.json');
      const original = readFileSync(gatesFile, 'utf8');
      const g = JSON.parse(original);
      delete g.docs;
      g.stopHook = { ...g.stopHook, sourceFilesWithoutSpec: 10 };
      writeFileSync(gatesFile, JSON.stringify(g, null, 2));
      check('docs gate: a pre-0002 threshold under stopHook is still honoured', docs().code, 0);
      check('docs gate: ...and lint says to move it', sh('node scripts/lint-docs.mjs || true').includes('moved to `docs.filesWithoutSpec`'), true);
      writeFileSync(gatesFile, original);
    }
    {
      const gatesFile = join(sandbox, '.claude/gates.json');
      const original = readFileSync(gatesFile, 'utf8');
      const g = JSON.parse(original);
      delete g.docs;
      g.stopHook = { ...g.stopHook, requireLogEntry: false };
      writeFileSync(gatesFile, JSON.stringify(g, null, 2));
      sh('git checkout -q -- src');
      writeFileSync(join(sandbox, 'src/legacy.mjs'), 'export const legacy = 1;\n');
      check('docs gate: a pre-0002 requireLogEntry: false is still honoured', docs().code, 0);
      rmSync(join(sandbox, 'src/legacy.mjs'));
      writeFileSync(gatesFile, JSON.stringify({ ...JSON.parse(original), docs: { logForNewFiles: false } }, null, 2));
      check(
        'docs gate: lint accepts a docs block without filesWithoutSpec',
        sh('node scripts/lint-docs.mjs 2>&1 || true').includes('docs.filesWithoutSpec'),
        false,
      );
      writeFileSync(gatesFile, original);
      edit3();
    }
    {
      const gatesFile = join(sandbox, '.claude/gates.json');
      const original = readFileSync(gatesFile, 'utf8');
      writeFileSync(gatesFile, JSON.stringify({ ...JSON.parse(original), stage: 'exploration' }, null, 2));
      const r = docs();
      check('docs gate: exploration reports and passes', r.code === 0 && r.out.includes('advisory'), true);
      writeFileSync(gatesFile, original);
    }
    reset();

    appendFileSync(ARCH(), '\n- wording only\n');
    const adr = (env) => run('node scripts/check-adr-drift.mjs', env).code;
    check('ADR gate: a No-ADR-reason line justifies the trigger', adr({ PR_BODY: 'No-ADR-reason: wording clarified, the architecture itself is unchanged' }), 0);
    check('ADR gate: a label mentioned without a reason does not', adr({ PR_BODY: 'Labelled no-adr-needed.' }), 1);
    check('ADR gate: a short reason fails', adr({ PR_BODY: 'No-ADR-reason: meh' }), 1);
    reset();
    for (const n of ['a', 'b', 'c', 'd']) rmSync(join(sandbox, `src/${n}.mjs`));
    commitAll('docs gate cleanup');
    sh('git branch -f main HEAD');
  }

  // permissions.deny on Read never covered the shell.
  const denied = (cmd) =>
    hook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: cmd } }) ? 'deny' : 'allow';
  check('secret guard denies reading .env', denied('cat .env'), 'deny');
  check('secret guard denies a private key', denied('cp ~/.ssh/id_rsa /tmp/x'), 'deny');
  check('secret guard denies it inside python', denied(`python3 -c "open('.env').read()"`), 'deny');
  check('secret guard allows .env.example', denied('cat .env.example'), 'allow');
  check('secret guard allows ordinary work', denied('npm test'), 'allow');
  check('secret guard ignores non-Bash tools', hook('pre-bash.mjs', { tool_name: 'Read' }) ? 'deny' : 'allow', 'allow');
  // Prose and loaders are not reads: these tripped the old token split in the first hour of work.
  check('secret guard ignores .env in a commit message', denied('git commit -m "add .env to gitignore"'), 'allow');
  check('secret guard ignores .env in a quoted title', denied('gh pr create --title "document .env handling"'), 'allow');
  check('secret guard ignores echo into .gitignore', denied('echo ".env.local" >> .gitignore'), 'allow');
  check('secret guard allows an env file handed to a loader', denied('docker compose --env-file .env up'), 'allow');
  check('secret guard allows --env-file=', denied('node --env-file=.env server.js'), 'allow');
  check('secret guard allows ls of key names', denied('ls config/*.key'), 'allow');
  check('secret guard allows a file named secrets in code', denied('cat src/config/secrets.ts'), 'allow');
  check('secret guard allows creating .env from the example', denied('cp .env.example .env'), 'allow');
  writeFileSync(join(sandbox, '.env'), 'X=1\n');
  check('...but not over an existing .env', denied('cp .env.example .env'), 'deny');
  rmSync(join(sandbox, '.env'));
  // The strict reading still holds where it matters.
  check('secret guard denies writing .env by redirect', denied('echo X=1 > .env'), 'deny');
  check('secret guard denies reading by input redirect', denied('cat < .env'), 'deny');
  check('secret guard denies inside a substitution', denied('echo $(cat .env)'), 'deny');
  check('secret guard denies inside bash -c', denied('bash -c "cat .env"'), 'deny');
  check('secret guard denies copying .env out', denied('cp .env /tmp/leak'), 'deny');
  check('secret guard denies grep on .env', denied('grep -r KEY .env'), 'deny');
  check('secret guard denies a secrets.json', denied('cat config/secrets.json'), 'deny');

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
  check('engineer may write infrastructure code', scoped('fixture-writer', 'Write', { file_path: 'infra/envs/prod/main.tf' }), 'allow');
  check('engineer may not write product docs', scoped('fixture-writer', 'Write', { file_path: 'docs/product/vision.md' }), 'deny');
  check('engineer may not write outside the project', scoped('fixture-writer', 'Write', { file_path: '/tmp/x.tf' }), 'deny');
  check('engineer may plan behind cd', scoped('fixture-writer', 'Bash', { command: 'cd infra/envs/prod && terraform plan' }), 'allow');
  check('engineer may not chain', scoped('fixture-writer', 'Bash', { command: 'terraform plan && terraform fmt' }), 'deny');
  check('reviewer may write only its review', scoped('fixture-reviewer', 'Write', { file_path: 'docs/specs/0002-net/review.md' }), 'allow');
  check('reviewer may not edit the code it reviews', scoped('fixture-reviewer', 'Edit', { file_path: 'infra/envs/prod/main.tf' }), 'deny');
  check('reviewer may not reformat, only check', scoped('fixture-reviewer', 'Bash', { command: 'terraform fmt -recursive' }), 'deny');
  check('code-reviewer may pipe read-only commands', scoped('fixture-reader', 'Bash', { command: 'git diff | head -50' }), 'allow');
  check('code-reviewer may not redirect into a file', scoped('fixture-reader', 'Bash', { command: 'git diff > notes.txt' }), 'deny');
  check('code-reviewer may not sed -i', scoped('fixture-reader', 'Bash', { command: "sed -i 's/a/b/' src/x.js" }), 'deny');
  check('quoted pipes are not pipes', scoped('fixture-reader', 'Bash', { command: 'rg -n "foo|bar" scripts 2>/dev/null' }), 'allow');
  check('read-only profiles cannot find -delete', scoped('fixture-reader', 'Bash', { command: 'find . -name x -delete' }), 'deny');
  check('architect may propose a new ADR', scoped('fixture-creator', 'Write', { file_path: 'docs/decisions/0099-state-backend.md' }), 'allow');
  check('architect may not rewrite an accepted ADR', scoped('fixture-creator', 'Write', { file_path: 'docs/decisions/0000-record-architecture-decisions.md' }), 'deny');
  check('an unknown profile refuses everything', scoped('nobody', 'Bash', { command: 'ls' }), 'deny');
  check('scope hook ignores read-only tools', scoped('fixture-reader', 'Read', { file_path: 'src/x.js' }), 'allow');

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

  // A fix that must stay: removing its marker fails lint, naming why it mattered. The marker is a
  // fixture of this test, not one the template ships, so moving or retiring a shipped marker
  // cannot silently turn this into a test of nothing.
  {
    const gatesFile = join(sandbox, '.claude/gates.json');
    const gatesOriginal = readFileSync(gatesFile, 'utf8');
    const fixed = join(sandbox, 'scripts/fixture-fix.mjs');
    writeFileSync(fixed, "export const guarded = 'fixture-guard-string';\n");
    const g = JSON.parse(gatesOriginal);
    g.markers = [...(g.markers ?? []), {
      id: 'fixture-marker', file: 'scripts/fixture-fix.mjs', marker: 'fixture-guard-string',
      why: 'fixture: proves the marker mechanism, independent of shipped markers.',
    }];
    writeFileSync(gatesFile, JSON.stringify(g, null, 2));
    const lintOut = () => {
      try {
        return sh('node scripts/lint-docs.mjs');
      } catch (e) {
        return e.stdout ?? '';
      }
    };
    check('a present marker passes lint', lintOut().includes('fixture-marker'), false);
    writeFileSync(fixed, 'export const guarded = null;\n');
    const out = lintOut();
    check('removing a guarded fix fails lint', out.includes('marker `fixture-marker` is gone'), true);
    check('...and says why the fix mattered', out.includes('independent of shipped markers'), true);
    rmSync(fixed);
    writeFileSync(gatesFile, gatesOriginal);
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
    const rule = join(sandbox, '.claude/rules/source.md');
    const originalRule = readFileSync(rule, 'utf8');
    writeFileSync(rule, originalRule.replace(/^description:.*$/m, ''));
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
    writeFileSync(rule, originalRule);
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

  // A UI spec cannot be approved before the design system is.
  {
    const dir = join(sandbox, 'docs/specs/0004-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plan.md'), '---\ntype: plan\n---\n# plan\n');
    writeFileSync(join(dir, 'tasks.md'), '---\ntype: tasks\n---\n# tasks\n');
    writeFileSync(
      join(dir, 'spec.md'),
      ['---', 'type: spec', 'id: "0004"', 'status: approved', 'date: 2026-09-24', 'owner: x', 'adrs: []', 'ui: true',
       'design: design/prototypes/dashboard.html', '---', '# 0004 - Dashboard', '',
       'Companion documents: [plan](plan.md), [tasks](tasks.md).', '', '## Acceptance criteria', '',
       '1. When a user opens the dashboard, the system shall show their open invoices.', '', '## Security', '',
       'Read-only view of the caller\'s own invoices behind the existing session check.', '',
       '## Open questions', '', '- [x] none', ''].join('\n'),
    );
    appendFileSync(join(sandbox, 'docs/INDEX.md'), '\n- [Dashboard](specs/0004-dashboard/spec.md)\n');
    const out = () => sh('node scripts/lint-docs.mjs || true');
    check('a UI spec without a design system cannot be approved', out().includes('there is no `docs/design/system.md`'), true);
    mkdirSync(join(sandbox, 'docs/design'), { recursive: true });
    const system = (status) =>
      writeFileSync(join(sandbox, 'docs/design/system.md'), `---\ntype: design\nstatus: ${status}\nlast_verified: 2026-09-24\n---\n# Design system\n`);
    appendFileSync(join(sandbox, 'docs/INDEX.md'), '\n- [Design system](design/system.md)\n');
    system('draft');
    check('a UI spec waits for the design to be approved', out().includes('design system is `draft`'), true);
    system('stable');
    check('a UI spec passes once the design is approved', out().includes('0004-dashboard'), false);
    rmSync(dir, { recursive: true, force: true });
    rmSync(join(sandbox, 'docs/design'), { recursive: true, force: true });
    sh('git checkout -- docs/INDEX.md');
  }

  check('design-reviewer may capture a screenshot', scoped('fixture-browser', 'Bash', { command: 'npx playwright screenshot --viewport-size=375,812 http://localhost:3000 /tmp/a.png' }), 'allow');
  check('design-reviewer may not edit components', scoped('fixture-browser', 'Edit', { file_path: 'src/components/ui/button.tsx' }), 'deny');

  // The security reviewer reads and scans, and cannot change anything.
  check('security-reviewer may run a scanner', scoped('fixture-scanner', 'Bash', { command: 'semgrep scan --config p/default --metrics=off' }), 'allow');
  check('security-reviewer may not write', scoped('fixture-scanner', 'Write', { file_path: 'src/auth.ts' }), 'deny');
  check('security-reviewer may not run the build', scoped('fixture-scanner', 'Bash', { command: 'npm run build' }), 'deny');

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
    const rule = join(sandbox, '.claude/rules/source.md');
    const originalRule = readFileSync(rule, 'utf8');
    writeFileSync(rule, '---\ndescription: PLACEHOLDER fixture\npaths: [src/**]\n---\n# Fixture\n');
    const ob = join(sandbox, '.claude/onboarding.json');
    const original = readFileSync(ob, 'utf8');
    writeFileSync(ob, JSON.stringify({ ...JSON.parse(original), status: 'completed', phase: 7 }));
    check('placeholder rules warn once onboarding is complete', sh('node scripts/lint-docs.mjs || true').includes('rules/source.md: still a placeholder after onboarding'), true);
    writeFileSync(ob, original);
    check('placeholder rules are expected before onboarding', sh('node scripts/lint-docs.mjs || true').includes('still a placeholder after onboarding'), false);
    writeFileSync(rule, originalRule);
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

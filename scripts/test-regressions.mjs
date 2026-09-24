#!/usr/bin/env node
// Run against a supplied checkout to establish red results before applying fixes.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(process.argv[2] ?? '.');
let failed = 0;
// The caller's escape hatches must not reach the gates under test. `SKIP_ADR_CHECK` set for the
// caller's own change made every "fails without an ADR" case pass vacuously, and `BASE_REF` would
// point the sandbox at a commit it does not have.
for (const key of ['SKIP_ADR_CHECK', 'BASE_REF']) delete process.env[key];

function run(dir, command, args = [], env = {}) {
  return spawnSync(command, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
}
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'starter-regression-'));
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of new Set(files)) {
    if (!existsSync(join(root, file))) continue;
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(root, file), join(dir, file));
  }
  json(dir, '.claude/gates.json', (g) => ({ ...g, stage: 'building' }));
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'not-started' }));
  run(dir, 'git', ['init', '-q', '-b', 'main']);
  commit(dir);
  run(dir, 'git', ['switch', '-qc', 'work']);
  return dir;
}
function commit(dir) {
  for (const args of [['add', '-A'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']]) {
    if (args.includes('commit') && run(dir, 'git', ['diff', '--cached', '--quiet']).status === 0) continue;
    const r = run(dir, 'git', args);
    if (r.status !== 0) throw new Error(r.stderr);
  }
}
function test(name, fn) {
  const dir = fixture();
  try {
    const detail = fn(dir);
    console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}: ${e.message}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function expect(result, code) {
  if (result.status !== code) throw new Error(`exit ${result.status}, expected ${code}\n${result.stdout}\n${result.stderr}`);
}
function json(dir, file, change) {
  const path = join(dir, file);
  writeFileSync(path, JSON.stringify(change(JSON.parse(readFileSync(path, 'utf8'))), null, 2));
}
function projectAdr(dir, id) {
  const file = `docs/decisions/${id}-fixture.md`;
  writeFileSync(join(dir, file), readFileSync(join(dir, 'docs/decisions/0000-record-architecture-decisions.md'), 'utf8').replace('id: "0000"', `id: "${id}"`));
  return file;
}

test('suite survives disabled optional profiles', (dir) => {
  if (existsSync(join(dir, 'scripts/adapt-template.mjs'))) {
    expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'infra,design', '--confirm']), 0);
  } else {
    json(dir, '.claude/gates.json', (g) => {
      for (const key of Object.keys(g.agentScopes)) if (key.startsWith('infra-') || key === 'design-reviewer') delete g.agentScopes[key];
      return g;
    });
    for (const name of ['infra-architect', 'infra-engineer', 'infra-reviewer', 'design-reviewer']) rmSync(join(dir, `.claude/agents/${name}.md`));
  }
  commit(dir);
  expect(run(dir, 'node', ['scripts/test-gates.mjs']), 0);
});
test('suite survives replacement of source-rule placeholder', (dir) => {
  const path = join(dir, '.claude/rules/source.md');
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('PLACEHOLDER', 'Project'));
  commit(dir);
  expect(run(dir, 'node', ['scripts/test-gates.mjs']), 0);
});
test('suite copies a working tree with an unstaged deletion', (dir) => {
  const file = join(dir, 'ordinary-file.txt');
  writeFileSync(file, 'fixture'); commit(dir); rmSync(file);
  expect(run(dir, 'node', ['scripts/test-gates.mjs']), 0);
});
test('deleting a project ADR is not coverage, even beside a new ADR', (dir) => {
  const file = projectAdr(dir, '0090'); commit(dir);
  expect(run(dir, 'git', ['branch', '-f', 'main', 'HEAD']), 0);
  rmSync(join(dir, file)); projectAdr(dir, '0091');
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs']), 1);
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs'], { SKIP_ADR_CHECK: 'fixture skip with a reason' }), 1);
});
test('missing test runner is an environment failure before dry-run plan', (dir) => {
  const r = run(dir, 'node', ['scripts/repair.mjs', '--test', 'starter-fixture-command-does-not-exist', '--test-file', 'README.md']);
  expect(r, 3);
  if (r.stdout.includes('"plan"')) throw new Error('environment failure generated a repair plan');
});

test('runner exit 126, 127, command-not-found and signals stop before spawning', (dir) => {
  for (const command of ['exit 126', 'exit 127', 'printf "runner: command not found\\n" >&2; exit 1', 'kill -TERM $$']) {
    const r = run(dir, 'node', ['scripts/repair.mjs', '--test', command, '--test-file', 'README.md', '--confirm'], { REPAIR_CLAUDE_BIN: 'must-not-be-spawned' });
    expect(r, 3);
    assert.equal(JSON.parse(r.stdout).reason, 'test-environment-failure');
  }
});
test('an escape hatch in the caller environment does not leak into the gate tests', (dir) => {
  const r = run(dir, 'node', ['scripts/test-gates.mjs'], { SKIP_ADR_CHECK: 'caller skipping their own change on purpose' });
  expect(r, 0);
  assert.match(r.stdout, /ok\s+architecture change without an ADR fails/);
});
test('template ADR deletion is allowed only before onboarding completes', (dir) => {
  const manifest = JSON.parse(readFileSync(join(dir, '.claude/tracks.json'), 'utf8'));
  const record = manifest.templateRecords.find((r) => r.kind === 'adr');
  if (!record) return 'no template history remains in this derived project';
  rmSync(join(dir, record.path));
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs']), 0);
  // Onboarding completes on the same branch as its cleanup: still the permitted cleanup, silently.
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'completed' }));
  const sameBranch = run(dir, 'node', ['scripts/check-adr-drift.mjs']);
  expect(sameBranch, 0);
  assert.doesNotMatch(sameBranch.stderr, /ADR deletion is forbidden/);
  // Once completion is in the base, the same deletion is a violation.
  run(dir, 'git', ['checkout', '--', record.path]);
  commit(dir);
  expect(run(dir, 'git', ['branch', '-f', 'main', 'HEAD']), 0);
  rmSync(join(dir, record.path));
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs']), 1);
  json(dir, '.claude/gates.json', (g) => ({ ...g, stage: 'exploration' }));
  const advisory = run(dir, 'node', ['scripts/check-adr-drift.mjs']);
  expect(advisory, 0);
  assert.match(advisory.stderr, /ADR deletion is forbidden/);
});
test('resetting onboarding in the working tree cannot reopen the cleanup exception', (dir) => {
  const manifest = JSON.parse(readFileSync(join(dir, '.claude/tracks.json'), 'utf8'));
  const record = manifest.templateRecords.find((r) => r.kind === 'adr');
  if (!record) return 'no template history remains in this derived project';
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'completed' }));
  commit(dir);
  expect(run(dir, 'git', ['branch', '-f', 'main', 'HEAD']), 0);
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'in-progress' }));
  rmSync(join(dir, record.path));
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs']), 1);
});
test('registering a project ADR in the same diff cannot excuse its deletion', (dir) => {
  const file = projectAdr(dir, '0090'); commit(dir);
  expect(run(dir, 'git', ['branch', '-f', 'main', 'HEAD']), 0);
  json(dir, '.claude/tracks.json', (m) => {
    m.templateRecords.push({ kind: 'adr', id: '0090', path: file }); return m;
  });
  rmSync(join(dir, file)); projectAdr(dir, '0091');
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs']), 1);
});
test('manifest detects each unregistered surface and duplicate ownership', (dir) => {
  // Run the production validator, not a second implementation of its inventory.
  const probe = 'import {validateTracks} from "./scripts/tracks.mjs"; const errors=validateTracks(process.cwd()); console.log(errors.join("\\n")); process.exit(errors.length?1:0);';
  for (const file of ['.claude/agents/fixture.md', '.claude/skills/fixture/SKILL.md', '.claude/commands/fixture.md', '.claude/rules/fixture.md', '.claude/skills/engineering-rulebook/fixture.md', '.github/workflows/fixture.yml.example']) {
    mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), '# Fixture\n');
    const r = run(dir, 'node', ['--input-type=module', '-e', probe]); expect(r, 1); assert.match(r.stdout, /Unregistered files:/);
    rmSync(join(dir, file));
  }
  for (const [file, key] of [['.claude/gates.json', 'agentScopes'], ['.claude/settings.json', 'enabledPlugins']]) {
    const before = readFileSync(join(dir, file));
    json(dir, file, (value) => { value[key]['fixture'] = key === 'agentScopes' ? { write: [], bash: [] } : true; return value; });
    const r = run(dir, 'node', ['--input-type=module', '-e', probe]); expect(r, 1); assert.match(r.stdout, /Unregistered (profiles|plugins): fixture/);
    writeFileSync(join(dir, file), before);
  }
  json(dir, '.claude/tracks.json', (m) => { m.tracks.core.files.push(m.tracks.core.files[0]); return m; });
  const r = run(dir, 'node', ['--input-type=module', '-e', probe]); expect(r, 1); assert.match(r.stdout, /multiple owners/);
});
test('adapter refuses traversal before modifying any core file', (dir) => {
  const before = readFileSync(join(dir, '.claude/gates.json'), 'utf8');
  json(dir, '.claude/tracks.json', (m) => { m.tracks.fixture = { enabled: true, files: ['.claude/skills/../../README.md'], profiles: [], plugins: [] }; return m; });
  const rejected = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']);
  expect(rejected, 1); assert.match(rejected.stderr, /Unsafe manifest path/);
  assert.equal(readFileSync(join(dir, '.claude/gates.json'), 'utf8'), before);
  assert.ok(existsSync(join(dir, 'README.md')));
});
test('adapter rejects symlink targets and refuses completed history cleanup', (dir) => {
  const before = readFileSync(join(dir, 'README.md'), 'utf8');
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'completed' }));
  const completed = run(dir, 'node', ['scripts/adapt-template.mjs', '--reset-records', '--confirm']);
  expect(completed, 1); assert.match(completed.stderr, /cleanup requires unfinished onboarding/);
  symlinkSync(join(dir, 'README.md'), join(dir, '.claude/commands/linked.md'));
  json(dir, '.claude/tracks.json', (m) => {
    m.tracks.fixture = { enabled: true, files: ['.claude/commands/linked.md'], profiles: [], plugins: [] }; return m;
  });
  const linked = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']);
  expect(linked, 1); assert.match(linked.stderr, /Symlink is not a manifest target/);
  assert.equal(readFileSync(join(dir, 'README.md'), 'utf8'), before);
});
test('adapter removes local links inside a checkout path with spaces', (dir) => {
  const nested = join(dir, 'project space');
  mkdirSync(nested);
  // Reuse the fixture contents through a separate copy, leaving .git at the fixture root.
  for (const file of execFileSync('git', ['ls-files', '-z'], { cwd: dir, encoding: 'utf8' }).split('\0').filter(Boolean)) {
    mkdirSync(dirname(join(nested, file)), { recursive: true }); copyFileSync(join(dir, file), join(nested, file));
  }
  const target = '.claude/skills/fixture-pack/guide.md';
  mkdirSync(dirname(join(nested, target)), { recursive: true }); writeFileSync(join(nested, target), '# Guide\n');
  json(nested, '.claude/tracks.json', (m) => { m.tracks.fixture = { enabled: true, files: [target], profiles: [], plugins: [] }; return m; });
  const source = join(nested, '.claude/skills/engineering-rulebook/SKILL.md');
  writeFileSync(source, readFileSync(source, 'utf8') + '\n- [Fixture pack](../fixture-pack/guide.md)\n');
  expect(run(nested, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']), 0);
  assert.doesNotMatch(readFileSync(source, 'utf8'), /Fixture pack/);
});

// A real subprocess timeout proves the runner reports an environment failure without waiting
// for repair's production ten-minute timeout. Signal/launch branches also have deterministic inputs.
try {
  const { runTest } = await import(pathToFileURL(join(root, 'scripts/repair-test.mjs')));
  assert.ok(runTest('exec node -e "setInterval(() => {}, 1000)"', { timeout: 50 }).environmentError);
  assert.ok(runTest('fixture', { runner: () => ({ status: null, signal: 'SIGTERM' }) }).environmentError);
  assert.ok(runTest('fixture', { runner: () => ({ status: null, error: new Error('ENOENT') }) }).environmentError);
  assert.equal(runTest('fixture', { runner: () => ({ status: 1, stdout: 'assertion failed' }) }).environmentError, null);
  console.log('PASS timeout, signal, launch failure and ordinary test failure classification');
} catch (e) { failed++; console.error(`FAIL runner classification: ${e.message}`); }
console.log(`${failed} regression(s) failed`);
process.exitCode = failed ? 1 : 0;

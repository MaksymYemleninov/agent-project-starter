#!/usr/bin/env node
// Run against a supplied checkout to establish red results before applying fixes.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(process.argv[2] ?? '.');
let failed = 0;
// The caller's escape hatches must not reach the gates under test. `SKIP_ADR_CHECK` set for the
// caller's own change made every "fails without an ADR" case pass vacuously, and `BASE_REF` would
// point the sandbox at a commit it does not have.
for (const key of ['SKIP_ADR_CHECK', 'SKIP_DOCS_CHECK', 'PR_BODY', 'BASE_REF']) delete process.env[key];

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
  expect(run(dir, 'node', ['scripts/check-adr-drift.mjs'], { PR_BODY: 'No-ADR-reason: fixture reason that tries to excuse a deletion' }), 1);
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
test('adapter refuses to remove a pack another kept pack requires', (dir) => {
  // Own fixture tracks, so the test holds in derived projects whatever packs they kept.
  json(dir, '.claude/tracks.json', (m) => {
    m.tracks['fixture-base'] = { enabled: true, files: [], profiles: [], plugins: [] };
    m.tracks['fixture-pack'] = { enabled: true, files: [], profiles: [], plugins: [], requires: ['fixture-base'] };
    return m;
  });
  const before = readFileSync(join(dir, '.claude/tracks.json'), 'utf8');
  const rejected = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture-base', '--confirm']);
  expect(rejected, 1); assert.match(rejected.stderr, /fixture-pack requires fixture-base/);
  assert.equal(readFileSync(join(dir, '.claude/tracks.json'), 'utf8'), before);
  expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture-base,fixture-pack', '--confirm']), 0);
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

test('adapter changes nothing when a file it must touch is not writable', (dir) => {
  if (process.getuid?.() === 0) return; // root opens read-only files for update
  const files = ['.claude/commands/fixture-a.md', '.claude/commands/fixture-ro.md'];
  for (const f of files) writeFileSync(join(dir, f), '# Fixture\n');
  json(dir, '.claude/tracks.json', (m) => { m.tracks.fixture = { enabled: true, files, profiles: [], plugins: [] }; return m; });
  chmodSync(join(dir, files[1]), 0o444);
  const before = readFileSync(join(dir, '.claude/tracks.json'), 'utf8');
  const rejected = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']);
  expect(rejected, 1); assert.match(rejected.stderr, /Not writable, nothing was changed[\s\S]*fixture-ro\.md/);
  assert.ok(existsSync(join(dir, files[0])), 'the writable file must not be removed first');
  assert.equal(readFileSync(join(dir, '.claude/tracks.json'), 'utf8'), before);
  chmodSync(join(dir, files[1]), 0o644);
});
test('adapter does not rewrite or require a file whose content is unchanged', (dir) => {
  if (process.getuid?.() === 0) return;
  const target = '.claude/commands/fixture.md';
  writeFileSync(join(dir, target), '# Fixture\n');
  json(dir, '.claude/tracks.json', (m) => { m.tracks.fixture = { enabled: true, files: [target], profiles: [], plugins: [] }; return m; });
  for (const f of ['.claude/settings.json']) chmodSync(join(dir, f), 0o444);
  const ok = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']);
  chmodSync(join(dir, '.claude/settings.json'), 0o644);
  expect(ok, 0); assert.ok(!existsSync(join(dir, target)));
});
test('adapter says a stray numbered file is a Finder or iCloud copy', (dir) => {
  copyFileSync(join(dir, '.claude/commands/adr.md'), join(dir, '.claude/commands/adr 2.md'));
  const rejected = run(dir, 'node', ['scripts/adapt-template.mjs']);
  expect(rejected, 1); assert.match(rejected.stderr, /adr 2\.md \(looks like a Finder or iCloud copy of \.claude\/commands\/adr\.md/);
});
test('reset keeps the ADR entries in the index in order', (dir) => {
  if (!existsSync(join(dir, 'docs/decisions/_inherited-tooling.md'))) return;
  expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--reset-records', '--confirm']), 0);
  const index = readFileSync(join(dir, 'docs/INDEX.md'), 'utf8');
  assert.doesNotMatch(index, /Inherited tooling stub/);
  assert.ok(index.indexOf('[0000 - ') !== -1 && index.indexOf('[0000 - ') < index.indexOf('[0001 - Inherited tooling]'));
  assert.ok(!existsSync(join(dir, 'docs/decisions/_inherited-tooling.md')));
  assert.ok(existsSync(join(dir, 'docs/decisions/0001-inherited-tooling.md')));
});

const lint = (dir) => run(dir, 'node', ['scripts/lint-docs.mjs']);
const setStatus = (dir, file, status, extra = '') => {
  const abs = join(dir, file);
  writeFileSync(abs, readFileSync(abs, 'utf8').replace(/^adr: .*\n/m, '').replace(/^status: .*$/m, `status: ${status}${extra}`));
};
test('lint does not warn about an open question written as a TODO comment', (dir) => {
  setStatus(dir, 'docs/product/vision.md', 'draft');
  const abs = join(dir, 'docs/product/vision.md');
  writeFileSync(abs, readFileSync(abs, 'utf8') + '\n<!-- TODO: who pays for this? -->\n<!--\nTODO: and when?\n-->\n');
  assert.doesNotMatch(lint(dir).stdout, /vision\.md: \d+ TODO/);
});
test('lint still warns about a bare TODO marker', (dir) => {
  setStatus(dir, 'docs/product/vision.md', 'draft');
  const abs = join(dir, 'docs/product/vision.md');
  writeFileSync(abs, readFileSync(abs, 'utf8') + '\nTODO fix this later\n<!-- TODO: a real question -->\n');
  assert.match(lint(dir).stdout, /vision\.md: 1 TODO/);
});
test('lint accepts a deferred document that names its ADR, and rejects one that does not', (dir) => {
  const file = 'docs/architecture/data-model.md';
  const adr = '0000-record-architecture-decisions';
  for (const ref of ['0000', adr, `${adr}.md`, `decisions/${adr}.md`]) {
    setStatus(dir, file, 'deferred', `\nadr: ${ref}`);
    const ok = lint(dir); expect(ok, 0); assert.doesNotMatch(ok.stdout, /data-model\.md: still a template/);
  }
  setStatus(dir, file, 'deferred');
  const missing = lint(dir); expect(missing, 1); assert.match(missing.stdout + missing.stderr, /data-model\.md[\s\S]*no `adr`/);
  setStatus(dir, file, 'deferred', '\nadr: 0999');
  const unknown = lint(dir); expect(unknown, 1); assert.match(unknown.stdout + unknown.stderr, /names no file in docs\/decisions/);
});

// Spec 0004. This proves the statements are present, not that an agent obeys them.
test('onboarding command keeps the statements that match the environment and the skills', (dir) => {
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : null);
  const onboard = read('.claude/commands/onboard.md');
  if (!onboard) return;
  const phase4 = onboard.slice(onboard.indexOf('## Phase 4'), onboard.indexOf('## Phase 5'));
  assert.ok(phase4.indexOf('Preflight the environment') !== -1
    && phase4.indexOf('Preflight the environment') < phase4.indexOf('Propose a stack.'), 'preflight comes before the stack table');
  for (const word of ['ok', 'missing', 'unreachable', 'not checked']) assert.match(phase4, new RegExp(`\`${word}\``));
  assert.match(phase4, /<!-- TODO: verify <value> at <source> -->/);
  assert.match(phase4, /outside the\s+user's own machine/);
  assert.match(read('.claude/agents/infra-architect.md') ?? 'outside the user\'s own machine', /outside the user's own machine/);
  const phase5 = onboard.slice(onboard.indexOf('## Phase 5'), onboard.indexOf('## Phase 6'));
  assert.match(phase5, /Edit or Write tool[\s\S]*list the files you intend to change before the first edit/);
  assert.match(phase5, /status: deferred/);
  const phase7 = onboard.slice(onboard.indexOf('## Phase 7'), onboard.indexOf('## Rules for this command'));
  assert.match(phase7, /`plan\.md` and `tasks\.md` now too, each with `status: draft`/);
  assert.match(read('.claude/skills/writing-spec/SKILL.md') ?? 'phase 7', /phase 7/);
});

// Spec 0005. The contract types and options below are import-linter's, as its documentation lists
// them on 2026-10-15; extend the list when the pack adopts another type.
test('python pack ships a starter import-linter configuration that names only known contract types', (dir) => {
  const file = join(dir, '.claude/skills/engineering-rulebook/python.md');
  if (!existsSync(file)) return;
  const pack = readFileSync(file, 'utf8');
  const toml = pack.match(/```toml\n([\s\S]*?)```/)?.[1];
  assert.ok(toml, 'the pack has a toml starter block');
  const [top, ...contracts] = toml.split('[[tool.importlinter.contracts]]');
  assert.match(top, /^\s*root_package\s*=\s*"(\w+)"/m);
  const root = top.match(/^\s*root_package\s*=\s*"(\w+)"/m)[1];
  const known = new Set(['forbidden', 'layers', 'independence', 'protected', 'acyclic_siblings']);
  const types = contracts.map((c) => c.match(/^\s*type\s*=\s*"(\w+)"/m)?.[1]);
  for (const t of types) assert.ok(known.has(t), `unknown contract type: ${t}`);
  for (const t of ['acyclic_siblings', 'forbidden', 'layers']) assert.ok(types.includes(t), `a ${t} contract is shown`);
  for (const c of contracts) {
    const forbidden = c.match(/^\s*forbidden_modules\s*=\s*\[([^\]]*)\]/m)?.[1] ?? '';
    const external = [...forbidden.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((m) => m !== root && !m.startsWith(`${root}.`));
    if (external.length) {
      assert.match(top, /^\s*include_external_packages\s*=\s*true/m, `external ${external} needs include_external_packages`);
      for (const e of external) assert.ok(!e.includes('.'), `${e}: only a root-level external package can be forbidden`);
    }
  }
  assert.match(pack, /import-linter 2\.6 or\s+later/);
  assert.match(pack, /2\.1 or later/);
  assert.doesNotMatch(pack, /import-linter\s*(?:==|>=|~=|\^)\s*\d/);
  assert.match(pack, /ls -lO/); assert.match(pack, /not verified/);
});
test('the constitution stays within its budget and keeps its anchors', (dir) => {
  const file = join(dir, 'AGENTS.md');
  const agents = readFileSync(file, 'utf8');
  if (!agents.includes('Status: TEMPLATE')) return; // an onboarded project owns its size
  assert.ok(agents.split('\n').length <= 145, `AGENTS.md has ${agents.split('\n').length} lines, budget is 145`);
  for (let n = 1; n <= 8; n++) assert.match(agents, new RegExp(`^## ${n}\\. `, 'm'));
  for (let n = 1; n <= 8; n++) assert.match(agents, new RegExp(`^${n}\\. \\*\\*`, 'm'));
  for (const block of ['project', 'principles', 'code-map', 'commands']) {
    assert.ok(agents.includes(`<!-- onboard:${block} -->`) && agents.includes(`<!-- /onboard:${block} -->`), block);
  }
  const onboard = join(dir, '.claude/commands/onboard.md');
  if (existsSync(onboard)) assert.match(readFileSync(onboard, 'utf8'), /at\s+most six lines in total/);
});

// Spec 0006 (ADR 0020): the README belongs to the project, the operating knowledge to a skill.
const headings = (text) => [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
test('operating knowledge lives in the skill, once, and the template README stays short', (dir) => {
  const skillDir = join(dir, '.claude/skills/gates-and-tracks');
  if (!existsSync(skillDir)) return;
  const skill = ['SKILL.md', 'limits.md', 'lifecycle.md'].map((f) => readFileSync(join(skillDir, f), 'utf8')).join('\n');
  const readme = readFileSync(join(dir, 'README.md'), 'utf8');
  if (!/^# agent-project-starter$/m.test(readme)) return; // a project owns its README
  const moved = ['Gates are advisory until you say otherwise', 'The idea behind the gates', 'Things that must not quietly come back',
    'Tuning', 'Known limits', 'Template ownership and lifecycle checks', 'Agents stay in their lane', 'Repairing a failing test', 'Path-scoped rules'];
  for (const h of moved) {
    assert.ok(headings(skill).includes(h), `skill has "${h}"`);
    assert.ok(!headings(readme).includes(h), `README no longer has "${h}"`);
  }
  assert.ok(readme.split('\n').length <= 140, `README has ${readme.split('\n').length} lines, budget is 140`);
  assert.match(readme, /\(\.claude\/skills\/gates-and-tracks\/SKILL\.md\)/);
  assert.match(skill, /^description: .*gates.*tracks/m);
});
test('the project README stub keeps its shape', (dir) => {
  const file = join(dir, 'docs/_project-readme.md');
  if (!existsSync(file)) return;
  const stub = readFileSync(file, 'utf8');
  assert.ok(stub.split('\n').length <= 60);
  assert.deepEqual(headings(stub), ['Status', 'Run it', 'Layout', 'Documentation', 'Working with agents', 'Conventions']);
  assert.match(stub, /^# <project name>$/m);
  assert.match(stub, /Every sentence comes from a document that already exists/);
});
test('lint holds the README to the project after onboarding, and checks its links', (dir) => {
  const out = (r) => r.stdout + r.stderr;
  const readme = join(dir, 'README.md');
  const original = readFileSync(readme, 'utf8');
  if (!/^# agent-project-starter$/m.test(original) || !existsSync(join(dir, 'docs/_project-readme.md'))) return;
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'completed' }));
  const done = lint(dir);
  expect(done, 1); assert.match(out(done), /README\.md: onboarding completed but README\.md is still the template's/);
  assert.match(out(done), /_project-readme\.md: onboarding completed but the README stub is still here/);
  writeFileSync(readme, original.replace(/^# agent-project-starter$/m, '# Acme'));
  assert.doesNotMatch(out(lint(dir)), /still the template's/);
  json(dir, '.claude/onboarding.json', (s) => ({ ...s, status: 'not-started' }));
  writeFileSync(readme, original + '\n```md\n[example](docs/not-there.md)\n```\n');
  assert.doesNotMatch(out(lint(dir)), /README\.md: broken link/);
  writeFileSync(readme, original + '\n[gone](docs/not-there.md)\n');
  const broken = lint(dir); expect(broken, 1); assert.match(out(broken), /README\.md: broken link to `docs\/not-there\.md`/);
});
test('adapter drops README lines that link a removed file', (dir) => {
  const target = '.claude/skills/fixture-pack/guide.md';
  mkdirSync(dirname(join(dir, target)), { recursive: true }); writeFileSync(join(dir, target), '# Guide\n');
  json(dir, '.claude/tracks.json', (m) => { m.tracks.fixture = { enabled: true, files: [target], profiles: [], plugins: [] }; return m; });
  const readme = join(dir, 'README.md');
  writeFileSync(readme, readFileSync(readme, 'utf8') + '\n- **Fixture.** A bullet. See the [guide](.claude/skills/fixture-pack/guide.md).\n- **Kept.** Stays.\n');
  expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'fixture', '--confirm']), 0);
  const after = readFileSync(readme, 'utf8');
  assert.doesNotMatch(after, /Fixture\.\*\*/); assert.match(after, /\*\*Kept\.\*\*/);
  assert.equal(lint(dir).status, 0);
});
test('onboarding replaces the README in phase 7 and no longer adapts it in phase 5', (dir) => {
  const file = join(dir, '.claude/commands/onboard.md');
  if (!existsSync(file)) return;
  const onboard = readFileSync(file, 'utf8');
  const phase5 = onboard.slice(onboard.indexOf('## Phase 5'), onboard.indexOf('## Phase 6'));
  const phase7 = onboard.slice(onboard.indexOf('## Phase 7'), onboard.indexOf('## Rules for this command'));
  assert.doesNotMatch(phase5, /in README, AGENTS and commands/);
  assert.match(phase5, /The README is not\s+adapted: phase 7 replaces it/);
  assert.match(phase7, /Replace `README\.md` with the project's own, written from `docs\/_project-readme\.md`/);
  assert.match(phase7, /list only the commands phase 6 ran/);
  assert.match(phase7, /then delete the stub/);
});

// Spec 0007 (ADR 0021): optional-track text is marked, and cut with the track.
const text = (dir, file) => readFileSync(join(dir, file), 'utf8');
const addTrack = (dir, name, extra = {}) => json(dir, '.claude/tracks.json', (m) => {
  m.tracks[name] = { enabled: true, files: [], profiles: [], plugins: [], ...extra }; return m;
});
test('adapter cuts the marked text of a disabled track and keeps a kept track as it is', (dir) => {
  addTrack(dir, 'cutme'); addTrack(dir, 'keepme');
  const readme = join(dir, 'README.md'); const decision = join(dir, 'docs/decisions/0000-record-architecture-decisions.md');
  writeFileSync(readme, text(dir, 'README.md') + [
    '', 'Before.', '<!-- track:cutme -->', 'Block one.', '```md', '<!-- /track:cutme -->', 'in a fence, still cut', '```', '<!-- /track:cutme -->',
    'Middle.', '| row | cells | <!-- track:cutme -->', '<!-- track:keepme -->', 'Kept block.', '<!-- /track:keepme -->', 'After.',
    '```md', '<!-- track:cutme -->', 'an example, not a marker', '```', ''].join('\n'));
  writeFileSync(decision, text(dir, 'docs/decisions/0000-record-architecture-decisions.md') + '\n<!-- track:cutme -->\nhistory\n<!-- /track:cutme -->\n');
  const preview = run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'cutme']);
  expect(preview, 0); assert.ok(JSON.parse(preview.stdout).update.includes('README.md'));
  expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', 'cutme', '--confirm']), 0);
  const after = text(dir, 'README.md');
  assert.match(after, /Before\.\nMiddle\.\n<!-- track:keepme -->\nKept block\.\n<!-- \/track:keepme -->\nAfter\./);
  assert.doesNotMatch(after, /Block one|still cut|\| row \|/);
  assert.match(after, /an example, not a marker/);
  assert.match(text(dir, 'docs/decisions/0000-record-architecture-decisions.md'), /<!-- track:cutme -->\nhistory/);
});
test('lint rejects a marker that breaks the grammar, and a marker inside section 2', (dir) => {
  const out = (r) => r.stdout + r.stderr;
  addTrack(dir, 'known');
  const readme = join(dir, 'README.md'); const original = text(dir, 'README.md');
  const check = (add, pattern) => { writeFileSync(readme, original + add); const r = lint(dir); expect(r, 1); assert.match(out(r), pattern); };
  check('\n<!-- track:known -->\nnever closed\n', /README\.md: line \d+: block `known` is never closed/);
  check('\n<!-- /track:known -->\n', /closing marker for `known` has no opening marker/);
  check('\n<!-- track:known -->\n<!-- track:known -->\n<!-- /track:known -->\n<!-- /track:known -->\n', /blocks do not nest/);
  check('\ntext <!-- track:nothere -->\n', /marker names `nothere`, which is not an optional track/);
  check('\n<!-- track:core -->\nx\n<!-- /track:core -->\n', /marker names `core`/);
  writeFileSync(readme, original + '\n```md\n<!-- track:nothere -->\n```\n'); assert.doesNotMatch(out(lint(dir)), /nothere/);
  writeFileSync(readme, original);
  const agents = join(dir, 'AGENTS.md');
  if (!/^## 2\. /m.test(text(dir, 'AGENTS.md')) || !text(dir, 'AGENTS.md').includes('## 3. Repository map')) return;
  writeFileSync(agents, text(dir, 'AGENTS.md').replace('## 3. Repository map', '<!-- track:known -->\nx\n<!-- /track:known -->\n\n## 3. Repository map'));
  const principle = lint(dir); expect(principle, 1); assert.match(out(principle), /AGENTS\.md: line \d+: a track marker inside section 2/);
});
test('lint names a disabled track\'s assets left outside a marker', (dir) => {
  const out = (r) => r.stdout + r.stderr;
  addTrack(dir, 'gone', { enabled: false, files: ['.claude/skills/gone-skill/SKILL.md', '.claude/commands/gone.md'], profiles: ['gone-reviewer'] });
  const readme = join(dir, 'README.md'); const original = text(dir, 'README.md');
  const check = (add, status, pattern) => { writeFileSync(readme, original + add); const r = lint(dir); expect(r, status); if (pattern) assert.match(out(r), pattern); };
  check('\nSee gone-skill for details.\n', 1, /README\.md: line \d+ names `gone-skill` of the disabled track `gone` outside a marker/);
  check('\nRun /gone first.\n', 1, /names `\/gone`/);
  check('\nThe gone-reviewer agrees.\n', 1, /names `gone-reviewer`/);
  check('\nA line about gone-skill. <!-- track-ok: shares a word with a skill -->\n', 0);
  check('\nA line about gone-skill. <!-- track-ok: short -->\n', 1, /names `gone-skill`/);
  check('\n<!-- track:gone -->\nSee gone-skill and /gone.\n<!-- /track:gone -->\n', 0);
  check('\nSee gone-skill. <!-- track:gone -->\n', 0);
  check('\n```md\ngone-skill\n```\n', 0);
  check('\nThe path docs/gone/ and the word gone-skilled are not assets.\n', 0);
});
for (const [track, absent, present] of [
  ['infra', ['infra-reviewer', 'infra-change', '`/infra`', 'checkov', 'Never an agent', 'The infra track is unproven'], ['design-reviewer', '## Design']],
  ['design', ['design-reviewer', '`/design`', 'Design tokens drive', 'design tokens from'], ['infra-reviewer', '## Infrastructure']],
]) {
  test(`disabling ${track} leaves no mention of it and keeps the other track's text`, (dir) => {
    if (!existsSync(join(dir, `.claude/skills/${track === 'infra' ? 'infra-bootstrap' : 'design-system'}/SKILL.md`))) return;
    const files = ['AGENTS.md', 'README.md', '.claude/commands/harden.md', '.claude/commands/ship.md', 'docs/INDEX.md', 'docs/ops/environments.md',
      '.claude/skills/security-rulebook/scanners.md', '.claude/skills/engineering-rulebook/nextjs.md', '.claude/skills/engineering-rulebook/nestjs-nuxt.md',
      '.claude/skills/gates-and-tracks/limits.md'].filter((f) => existsSync(join(dir, f)));
    expect(run(dir, 'node', ['scripts/adapt-template.mjs', '--disable', track, '--confirm']), 0);
    const all = files.map((f) => text(dir, f)).join('\n');
    for (const gone of absent) assert.ok(!all.includes(gone), `"${gone}" is gone with ${track}`);
    for (const kept of present) assert.ok(all.includes(kept), `"${kept}" stays with the other track`);
    assert.ok(all.includes('<!-- track:'), 'the other track keeps its markers');
    const agents = text(dir, 'AGENTS.md');
    assert.ok(agents.split('\n').length <= 145);
    for (let n = 1; n <= 8; n++) assert.match(agents, new RegExp(`^${n}\\. \\*\\*`, 'm'));
    expect(lint(dir), 0);
  });
}

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

#!/usr/bin/env node
// A mechanical lifecycle fixture, not an application or a substitute for /harden approval.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { adaptTemplate } from './adapt-template.mjs';
import { readJson, validateTracks, walkFiles } from './tracks.mjs';

const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), 'starter-derived-'));
const run = (command, args) => execFileSync(command, args, { cwd: fixture, encoding: 'utf8', stdio: 'pipe' });
const write = (file, text) => { mkdirSync(dirname(join(fixture, file)), { recursive: true }); writeFileSync(join(fixture, file), text); };
const json = (file, value) => write(file, `${JSON.stringify(value, null, 2)}\n`);
const commit = () => {
  run('git', ['add', '-A']);
  run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'lifecycle fixture']);
};
try {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of new Set(files)) {
    if (!existsSync(join(root, file))) continue;
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    copyFileSync(join(root, file), join(fixture, file));
  }
  run('git', ['init', '-q', '-b', 'main']); commit();
  const manifest = readJson(fixture, '.claude/tracks.json');
  const resetRecords = existsSync(join(fixture, 'docs/decisions/_inherited-tooling.md'));
  // Existing consumers can run the same test after onboarding: never reset their history.
  json('.claude/onboarding.json', { status: 'in-progress', phase: 5, agreedButNotWritten: [] });
  const disable = Object.keys(manifest.tracks).filter((n) => n !== 'core' && n !== 'typescript');
  adaptTemplate(fixture, { disable, resetRecords, confirm: true });
  assert.deepEqual(validateTracks(fixture), []);
  if (resetRecords) for (const record of manifest.templateRecords) assert.equal(existsSync(join(fixture, record.path)), false, record.path);
  assert.ok(existsSync(join(fixture, '.claude/skills/engineering-rulebook/SKILL.md')));
  if (manifest.tracks.typescript?.enabled) assert.ok(existsSync(join(fixture, '.claude/skills/engineering-rulebook/typescript.md')));

  for (const file of walkFiles(fixture, 'docs').filter((f) => f.endsWith('.md') && !f.includes('/_'))) {
    const text = readFileSync(join(fixture, file), 'utf8');
    write(file, text.replace(/^status: template$/m, 'status: draft'));
  }
  for (const file of walkFiles(fixture, '.claude/rules')) {
    write(file, readFileSync(join(fixture, file), 'utf8').replaceAll('PLACEHOLDER', 'Fixture').replaceAll('Placeholder', 'Fixture'));
  }
  write('.claude/claude-security-guidance.md', '# Lifecycle fixture\n\nNo application security claims are made by this mechanical test.\n');
  write('AGENTS.md', '# Lifecycle fixture\n\nRead docs/INDEX.md. Application deployment and security approval are outside this test.\n');
  const stub = join(fixture, 'docs/security/_threat-model.md');
  if (existsSync(stub)) renameSync(stub, join(fixture, 'docs/security/threat-model.md'));
  write('docs/security/threat-model.md', '---\ntype: security\nstatus: draft\nlast_verified: 2026-09-24\n---\n# Fixture threat model\n\nOnly local tooling is exercised. Application controls are not assessed.\n');
  let index = readFileSync(join(fixture, 'docs/INDEX.md'), 'utf8').replaceAll('security/_threat-model.md', 'security/threat-model.md');
  if (!index.includes('(security/threat-model.md)')) index += '\n- [Threat model](security/threat-model.md)\n';
  write('docs/INDEX.md', index);
  write('src/lifecycle-fixture.mjs', 'export const fixture = true;\n');
  const gates = readJson(fixture, '.claude/gates.json');
  gates.stage = 'exploration'; gates.sourcePaths = ['src/**'];
  // Exercise customization of a core scope as well as removal of optional profiles.
  gates.agentScopes['security-reviewer'].bash = ['npm audit'];
  json('.claude/gates.json', gates);
  rmSync(join(fixture, '.claude/lint-baseline.json'), { force: true });
  // Advisory checks alone cannot establish that an adapted project has valid documents.
  json('.claude/gates.json', { ...gates, stage: 'building' });
  console.log(run('npm', ['run', 'lint:docs']));
  json('.claude/gates.json', gates);
  console.log(run('npm', ['run', 'check']));
  console.log(run('npm', ['run', 'test:regressions']));
  console.log('PASS derived project at exploration');
  commit(); // Model the onboarding merge before hardening on a subsequent branch.
  json('.claude/onboarding.json', { status: 'completed', phase: 7, completedPhases: [1, 2, 3, 4, 5, 6, 7], agreedButNotWritten: [] });
  json('.claude/gates.json', { ...gates, stage: 'building' });
  commit();
  console.log(run('npm', ['run', 'lint:docs', '--', '--update-baseline']));
  console.log(run('npm', ['run', 'check']));
  console.log(run('npm', ['run', 'test:regressions']));
  console.log('PASS derived project at building with a warning baseline');
  console.log('Not exercised: application build/deploy, scanners, ASVS assessment, human /harden approvals.');
} catch (e) {
  console.error(e.stdout?.toString() ?? '', e.stderr?.toString() ?? '', e.message);
  process.exitCode = 1;
} finally { rmSync(fixture, { recursive: true, force: true }); }

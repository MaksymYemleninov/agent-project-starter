#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, validateTracks, safePath, actualFiles, walkFiles } from './tracks.mjs';

/** Compute and validate the entire local operation before removing anything. */
export function adaptTemplate(root, { disable = [], resetRecords = false, confirm = false } = {}) {
  const errors = validateTracks(root);
  if (errors.length) throw new Error(errors.join('\n'));
  const manifest = readJson(root, '.claude/tracks.json');
  const gates = readJson(root, '.claude/gates.json');
  const settings = readJson(root, '.claude/settings.json');
  const state = readJson(root, '.claude/onboarding.json');
  const remove = [];
  for (const name of new Set(disable)) {
    if (name === 'core' || !manifest.tracks[name]) throw new Error(`Cannot disable track: ${name}`);
    const track = manifest.tracks[name];
    if (!track.enabled) continue;
    remove.push(...track.files.flatMap((f) => actualFiles(root, f)));
    for (const profile of track.profiles) delete gates.agentScopes[profile];
    for (const plugin of track.plugins) delete settings.enabledPlugins[plugin];
    track.enabled = false;
  }
  if (resetRecords) {
    if (!['not-started', 'in-progress'].includes(state.status)) throw new Error('Template cleanup requires unfinished onboarding');
    if (!existsSync(safePath(root, 'docs/decisions/_inherited-tooling.md'))) throw new Error('Inherited tooling stub is missing; do not replay template cleanup');
    for (const record of manifest.templateRecords) {
      const path = safePath(root, record.path);
      if (!existsSync(path)) continue;
      remove.push(...(record.kind === 'spec' ? walkFiles(root, record.path) : [record.path]));
    }
    const target = 'docs/decisions/0001-inherited-tooling.md';
    if (existsSync(safePath(root, target)) && !remove.includes(target)) throw new Error('Refusing to overwrite an existing inherited ADR');
    gates.stage = 'exploration';
  }
  const writes = ['.claude/tracks.json', '.claude/gates.json', '.claude/settings.json', 'docs/INDEX.md'];
  if (resetRecords) writes.push('docs/log.md', 'docs/decisions/0001-inherited-tooling.md');
  for (const file of [...remove, ...writes]) safePath(root, file);
  // Remove Markdown links to disabled packs, not arbitrary prose or project documents.
  const removed = new Set(remove);
  const edited = new Map();
  for (const file of [...walkFiles(root, '.claude/skills'), ...walkFiles(root, 'docs')]) {
    if (removed.has(file) || !file.endsWith('.md') || (resetRecords && file === 'docs/log.md')) continue;
    const abs = safePath(root, file);
    const before = readFileSync(abs, 'utf8');
    const after = before.split('\n').filter((line) => {
      const links = [...line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
      return !links.some((m) => {
        if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(m[1])) return false;
        const target = decodeURI(m[1].split('#')[0]);
        return removed.has(relative(resolve(root), resolve(dirname(abs), target)));
      });
    }).join('\n');
    if (before !== after) edited.set(file, after);
  }
  const plan = { remove, disable, resetRecords, update: [...new Set([...writes, ...edited.keys()])] };
  if (!confirm) return plan;
  for (const file of remove) rmSync(safePath(root, file));
  if (resetRecords) {
    for (const record of manifest.templateRecords.filter((r) => r.kind === 'spec')) {
      // All descendant paths were validated and their files removed above.
      if (existsSync(join(root, record.path))) rmSync(join(root, record.path), { recursive: true });
    }
    renameSync(join(root, 'docs/decisions/_inherited-tooling.md'), join(root, 'docs/decisions/0001-inherited-tooling.md'));
    const path = join(root, 'docs/decisions/0001-inherited-tooling.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace(/^date: .*$/m, `date: ${new Date().toISOString().slice(0, 10)}`));
    const index = edited.get('docs/INDEX.md') ?? readFileSync(join(root, 'docs/INDEX.md'), 'utf8');
    edited.set('docs/INDEX.md', index.replace(/- \[Inherited tooling stub\][\s\S]*?(?=\n- \[0000)/,
      '- [0001 - Inherited tooling](decisions/0001-inherited-tooling.md) - accepted'));
    writeFileSync(join(root, 'docs/log.md'), '# Change Log\n\n## ' + new Date().toISOString().slice(0, 10) + '\n\n- Started from agent-project-starter.\n');
    // Exact old paths must remain available to the branch's base for deletion auditing; current
    // projects must not keep claiming those numeric IDs as removable template history.
    manifest.templateRecords = [];
  }
  for (const [file, text] of edited) writeFileSync(safePath(root, file), text);
  for (const [file, value] of [['.claude/tracks.json', manifest], ['.claude/gates.json', gates], ['.claude/settings.json', settings]]) {
    writeFileSync(join(root, file), `${JSON.stringify(value, null, 2)}\n`);
  }
  return plan;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = process.argv.slice(2);
    const options = { disable: [], resetRecords: false, confirm: false };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--disable' && args[i + 1]) options.disable = args[++i].split(',');
      else if (args[i] === '--reset-records') options.resetRecords = true;
      else if (args[i] === '--confirm') options.confirm = true;
      else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    console.log(JSON.stringify(adaptTemplate(process.cwd(), options), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}

#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, rmSync, openSync, closeSync, accessSync, constants } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, validateTracks, safePath, actualFiles, walkFiles } from './tracks.mjs';
import { cutMarkers, isHistory, markerFiles, NAMES_EXEMPT } from './track-markers.mjs';

/** Replace the inherited-tooling stub entry (two lines) with ADR 0001, placed after 0000. */
function inheritedAdrInIndex(index) {
  return index
    .replace(/- \[Inherited tooling stub\][\s\S]*?\n(?=- \[0000)/, '')
    .replace(/(- \[0000 [^\n]*\n)/, '$1- [0001 - Inherited tooling](decisions/0001-inherited-tooling.md) - accepted\n');
}

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
  for (const [name, track] of Object.entries(manifest.tracks)) {
    const missing = (track.requires ?? []).filter((dep) => track.enabled && !manifest.tracks[dep]?.enabled);
    if (missing.length) throw new Error(`Track ${name} requires ${missing.join(', ')}; disable it too or keep them`);
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
  // The text of a disabled track goes with its files (ADR 0021); Markdown links to removed files go
  // line by line. Both apply to the same set of files, and cutting comes first.
  const disabledTracks = new Set(Object.entries(manifest.tracks).filter(([name, track]) => name !== 'core' && !track.enabled).map(([name]) => name));
  const readme = existsSync(join(root, 'README.md')) ? ['README.md'] : [];
  const scanned = new Set([...walkFiles(root, '.claude/skills'), ...walkFiles(root, 'docs'), ...readme, ...markerFiles(root)]);
  for (const file of scanned) {
    if (removed.has(file) || !file.endsWith('.md') || (resetRecords && file === 'docs/log.md')) continue;
    const abs = safePath(root, file);
    const before = readFileSync(abs, 'utf8');
    const cut = isHistory(file) || NAMES_EXEMPT.has(file) || !disabledTracks.size ? before : cutMarkers(before, disabledTracks);
    const after = cut.split('\n').filter((line) => {
      const links = [...line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
      return !links.some((m) => {
        if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(m[1])) return false;
        const target = decodeURI(m[1].split('#')[0]);
        return removed.has(relative(resolve(root), resolve(dirname(abs), target)));
      });
    }).join('\n');
    if (before !== after) edited.set(file, after);
  }
  // Every output is computed before anything is touched, so a failure to write can be reported
  // while the tree is still whole, and a file whose content would not change is left alone.
  const today = new Date().toISOString().slice(0, 10);
  const stub = 'docs/decisions/_inherited-tooling.md';
  const adr = 'docs/decisions/0001-inherited-tooling.md';
  const outputs = new Map(edited);
  const templateSpecs = manifest.templateRecords.filter((r) => r.kind === 'spec');
  if (resetRecords) {
    // Exact old paths must remain available to the branch's base for deletion auditing; current
    // projects must not keep claiming those numeric IDs as removable template history.
    manifest.templateRecords = [];
    outputs.set(adr, readFileSync(join(root, stub), 'utf8').replace(/^date: .*$/m, `date: ${today}`));
    outputs.set('docs/INDEX.md', inheritedAdrInIndex(outputs.get('docs/INDEX.md') ?? readFileSync(join(root, 'docs/INDEX.md'), 'utf8')));
    outputs.set('docs/log.md', `# Change Log\n\n## ${today}\n\n- Started from agent-project-starter.\n`);
  }
  for (const [file, value] of [['.claude/tracks.json', manifest], ['.claude/gates.json', gates], ['.claude/settings.json', settings]]) {
    outputs.set(file, `${JSON.stringify(value, null, 2)}\n`);
  }
  const changed = [...outputs].filter(([file, text]) => {
    const abs = safePath(root, file);
    return !existsSync(abs) || readFileSync(abs, 'utf8') !== text;
  }).map(([file]) => file);

  const notWritable = [];
  const openable = (abs) => { try { closeSync(openSync(abs, 'r+')); return true; } catch { return false; } };
  const dirWritable = (abs) => { try { accessSync(dirname(abs), constants.W_OK); return true; } catch { return false; } };
  // Opening for update does not change the file, and unlike access(2) it fails where the sandbox
  // denies the path. A removal also needs its directory.
  for (const file of [...remove, ...(resetRecords ? [stub] : [])]) {
    const abs = safePath(root, file);
    if (existsSync(abs) && !(openable(abs) && dirWritable(abs))) notWritable.push(file);
  }
  for (const file of changed) {
    const abs = safePath(root, file);
    if (!(existsSync(abs) ? openable(abs) : dirWritable(abs))) notWritable.push(file);
  }
  if (notWritable.length) {
    throw new Error(`Not writable, nothing was changed:\n${[...new Set(notWritable)].map((f) => `  - ${f}`).join('\n')}\n` +
      'Make these writable (or edit them with approval) and run the adapter again.');
  }

  const plan = { remove, disable, resetRecords, update: changed };
  if (!confirm) return plan;
  for (const file of remove) rmSync(safePath(root, file));
  if (resetRecords) {
    for (const record of templateSpecs) {
      // All descendant paths were validated and their files removed above.
      if (existsSync(join(root, record.path))) rmSync(join(root, record.path), { recursive: true });
    }
    rmSync(join(root, stub));
  }
  for (const file of changed) writeFileSync(safePath(root, file), outputs.get(file));
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

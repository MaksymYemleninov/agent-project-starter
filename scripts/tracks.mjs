import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';

export const readJson = (root, file) => JSON.parse(readFileSync(safePath(root, file), 'utf8'));

export function safePath(root, file) {
  if (typeof file !== 'string' || !file || file.includes('\\') || file.includes('\0') ||
      isAbsolute(file) || file.split('/').some((p) => !p || p === '.' || p === '..')) {
    throw new Error(`Unsafe manifest path: ${file}`);
  }
  const abs = resolve(root, file);
  if (relative(resolve(root), abs).startsWith('..')) throw new Error(`Path escapes project: ${file}`);
  let current = resolve(root);
  for (const part of file.split('/')) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink is not a manifest target: ${file}`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return abs;
}

export function walkFiles(root, dir) {
  const abs = safePath(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const file = `${dir}/${name}`;
    const path = safePath(root, file);
    return lstatSync(path).isDirectory() ? walkFiles(root, file) : [file];
  });
}

// Both the example and its activated workflow retain the same owner.
export function actualFiles(root, file) {
  const candidates = file.endsWith('.example') ? [file, file.slice(0, -8)] : [file];
  return candidates.filter((f) => existsSync(safePath(root, f)));
}

export function validateTracks(root) {
  const errors = [];
  try {
    const manifest = readJson(root, '.claude/tracks.json');
    const gates = readJson(root, '.claude/gates.json');
    const settings = readJson(root, '.claude/settings.json');
    if (manifest.version !== 1 || !manifest.tracks || manifest.tracks.core?.enabled !== true) {
      throw new Error('Manifest needs version 1 and an enabled core track');
    }
    const owned = { files: new Map(), profiles: new Map(), plugins: new Map() };
    for (const [name, track] of Object.entries(manifest.tracks)) {
      if (!/^[a-z][a-z0-9-]*$/.test(name) || typeof track.enabled !== 'boolean') throw new Error(`Invalid track: ${name}`);
      for (const kind of Object.keys(owned)) {
        if (!Array.isArray(track[kind])) throw new Error(`${name}.${kind} must be an array`);
        for (const item of track[kind]) {
          if (typeof item !== 'string' || !item || item.startsWith('$')) throw new Error(`Invalid ${kind} in ${name}`);
          const keys = kind === 'files' && item.endsWith('.example') ? [item, item.slice(0, -8)] : [item];
          for (const key of keys) {
            if (owned[kind].has(key)) errors.push(`${kind} ${key} has multiple owners`);
            owned[kind].set(key, name);
          }
          let present;
          if (kind === 'files') {
            if (!/^(\.claude\/(agents|skills|commands|rules)\/|\.github\/)/.test(item)) throw new Error(`Unsupported track file: ${item}`);
            const actual = actualFiles(root, item);
            if (actual.some((f) => !lstatSync(safePath(root, f)).isFile())) throw new Error(`Track file must be a regular file: ${item}`);
            present = actual.length > 0;
          } else present = Object.hasOwn(kind === 'profiles' ? gates.agentScopes ?? {} : settings.enabledPlugins ?? {}, item);
          if (track.enabled && !present) errors.push(`${name}: missing ${kind} ${item}`);
          if (!track.enabled && present) errors.push(`${name}: disabled track still contains ${kind} ${item}`);
        }
      }
    }
    const files = ['agents', 'skills', 'commands', 'rules'].flatMap((d) => walkFiles(root, `.claude/${d}`));
    files.push(...walkFiles(root, '.github/workflows').filter((f) => /\.(yml|yaml)(\.example)?$/.test(f)));
    for (const file of ['.github/dependabot.yml.example', '.github/dependabot.yml']) if (existsSync(join(root, file))) files.push(file);
    const inventory = {
      files,
      profiles: Object.keys(gates.agentScopes ?? {}).filter((k) => !k.startsWith('$')),
      plugins: Object.keys(settings.enabledPlugins ?? {}),
    };
    for (const kind of Object.keys(owned)) {
      for (const item of inventory[kind]) if (!owned[kind].has(item)) errors.push(`Unregistered ${kind}: ${item}`);
    }
    if (!Array.isArray(manifest.templateRecords)) throw new Error('templateRecords must be an array');
    const records = new Set();
    for (const record of manifest.templateRecords) {
      const prefix = record.kind === 'adr' ? 'docs/decisions/' : record.kind === 'spec' ? 'docs/specs/' : null;
      if (!prefix || !/^\d{4}$/.test(record.id) || record.id === '0000' ||
          typeof record.path !== 'string' || !new RegExp(`^${prefix}${record.id}-[a-z0-9-]+${record.kind === 'adr' ? '\\.md' : ''}$`).test(record.path)) {
        throw new Error('Invalid template record');
      }
      safePath(root, record.path);
      const key = `${record.kind}:${record.id}`;
      if (records.has(key)) errors.push(`Duplicate template record: ${key}`);
      records.add(key);
    }
  } catch (e) { errors.push(e.message); }
  return errors;
}

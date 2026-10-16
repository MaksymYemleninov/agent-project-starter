/**
 * Markers that tie a piece of Markdown to an optional track (ADR 0021, spec 0007).
 *
 *   <!-- track:infra -->           a block: this line alone opens it,
 *   ...text...
 *   <!-- /track:infra -->          and this line alone closes it;
 *
 *   | a table row | <!-- track:infra -->      one line: the marker ends it.
 *
 * The adapter cuts the text of a disabled track, markers included, and leaves a kept track's
 * markers and text as they are. The linter checks the grammar and finds names of a disabled
 * track's assets that are left outside a marker. Markers inside fenced code blocks are examples
 * and are ignored.
 */
import { basename } from 'node:path';
import { walkFiles } from './tracks.mjs';

const OPEN = /^\s*<!--\s*track:([\w-]+)\s*-->\s*$/;
const CLOSE = /^\s*<!--\s*\/track:([\w-]+)\s*-->\s*$/;
const TAIL = /\S.*<!--\s*track:([\w-]+)\s*-->\s*$/;
const ESCAPE = /<!--\s*track-ok:\s*(.{10,}?)\s*-->\s*$/;
const FENCE = /^\s{0,3}(```|~~~)/;

// History is never rewritten; the onboarding command names every track because naming them is its job.
const HISTORY = [/^docs\/decisions\//, /^docs\/specs\//, /^docs\/log\.md$/];
export const isHistory = (file) => HISTORY.some((re) => re.test(file));
export const NAMES_EXEMPT = new Set(['.claude/commands/onboard.md']);

/** The Markdown files that may carry markers. */
export function markerFiles(root) {
  const files = ['AGENTS.md', 'README.md'];
  for (const dir of ['.claude/commands', '.claude/agents', '.claude/skills', '.claude/rules', 'docs']) files.push(...walkFiles(root, dir));
  return files.filter((f) => f.endsWith('.md')).filter((f) => !isHistory(f));
}

/** Marker lines of a text, with problems against the grammar. `known` is the set of optional track names. */
export function scanMarkers(text, known) {
  const items = [];
  const problems = [];
  let fenced = false;
  let open = null;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const no = i + 1;
    if (FENCE.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    let m;
    if ((m = line.match(OPEN))) {
      if (!known.has(m[1])) problems.push({ line: no, msg: `marker names \`${m[1]}\`, which is not an optional track in .claude/tracks.json` });
      if (open) problems.push({ line: no, msg: `block \`${m[1]}\` starts inside the block \`${open.name}\` from line ${open.line}; blocks do not nest` });
      else open = { name: m[1], line: no };
      items.push({ line: no, kind: 'open', name: m[1] });
    } else if ((m = line.match(CLOSE))) {
      if (!open) problems.push({ line: no, msg: `closing marker for \`${m[1]}\` has no opening marker` });
      else if (open.name !== m[1]) problems.push({ line: no, msg: `closing marker for \`${m[1]}\` does not match the open block \`${open.name}\` from line ${open.line}` });
      open = null;
      items.push({ line: no, kind: 'close', name: m[1] });
    } else if ((m = line.match(TAIL))) {
      if (!known.has(m[1])) problems.push({ line: no, msg: `marker names \`${m[1]}\`, which is not an optional track in .claude/tracks.json` });
      items.push({ line: no, kind: 'tail', name: m[1] });
    }
  });
  if (open) problems.push({ line: open.line, msg: `block \`${open.name}\` is never closed` });
  return { items, problems };
}

/** Remove the text of the tracks in `disabled`: its blocks, marker lines included, and its one-line markers. */
export function cutMarkers(text, disabled) {
  const out = [];
  let fenced = false;
  let cutting = null;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      if (!cutting) out.push(line);
      continue;
    }
    if (fenced) {
      if (!cutting) out.push(line);
      continue;
    }
    let m;
    if (cutting) {
      if ((m = line.match(CLOSE)) && m[1] === cutting) cutting = null;
      continue;
    }
    if ((m = line.match(OPEN)) && disabled.has(m[1])) { cutting = m[1]; continue; }
    if (!OPEN.test(line) && (m = line.match(TAIL)) && disabled.has(m[1])) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Names a track owns that a document can mention: skills, agents, commands, workflows, scope profiles. */
export function trackAssets(manifest) {
  const assets = {};
  for (const [name, track] of Object.entries(manifest.tracks)) {
    if (name === 'core') continue;
    const names = new Set(track.profiles ?? []);
    for (const file of track.files ?? []) {
      const parts = file.split('/');
      if (file.startsWith('.claude/skills/') && parts.length === 4 && parts[3] === 'SKILL.md') names.add(parts[2]);
      else if (file.startsWith('.claude/agents/')) names.add(basename(file, '.md'));
      else if (file.startsWith('.claude/commands/')) names.add(`/${basename(file, '.md')}`);
      else if (file.startsWith('.github/workflows/')) names.add(`${basename(file).split('.')[0]}.yml`);
    }
    assets[name] = [...names].filter(Boolean);
  }
  return assets;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameRegex = (n) => (n.startsWith('/') ? new RegExp(`(?<![\\w/.-])${esc(n)}(?![\\w-])`) : new RegExp(`(?<![\\w-])${esc(n)}(?![\\w-])`));

/**
 * Lines that name an asset of a disabled track outside a marker block, a fenced code block, a
 * Markdown link and a line that ends with an escape.
 */
export function leftovers(text, disabledAssets) {
  const found = [];
  const regexes = Object.entries(disabledAssets).flatMap(([track, names]) => names.map((n) => ({ track, name: n, re: nameRegex(n) })));
  let fenced = false;
  let inBlock = false;
  text.split('\n').forEach((line, i) => {
    if (FENCE.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    if (OPEN.test(line)) { inBlock = true; return; }
    if (CLOSE.test(line)) { inBlock = false; return; }
    if (inBlock || TAIL.test(line) || ESCAPE.test(line)) return;
    const bare = line.replace(/\[[^\]]*\]\([^)]*\)/g, '');
    for (const { track, name, re } of regexes) if (re.test(bare)) found.push({ line: i + 1, track, name });
  });
  return found;
}

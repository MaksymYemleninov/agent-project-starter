#!/usr/bin/env node
/**
 * Documentation gate.
 *
 * Prose reminders in an instruction file do not survive a long agent session. This does.
 * Run locally with `npm run lint:docs`; CI runs it on every pull request.
 *
 * Errors fail the build. Warnings are printed and do not.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const DOCS = join(ROOT, 'docs');

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push({ file, msg });
const warn = (file, msg) => warnings.push({ file, msg });
const rel = (p) => relative(ROOT, p) || p;

const DAY = 86400000;
const now = Date.now();
const today = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ helpers */

/**
 * Read a file with line endings normalized.
 * Without this, a Windows checkout with autocrlf turns every frontmatter block into `\r`-suffixed
 * keys, the parser returns an empty object, and the linter reports every document as malformed.
 */
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Minimal YAML frontmatter reader. Enough for the flat key/value contract used here. */
function frontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const data = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let [, key, value] = m;
    value = value.trim().replace(/\s+#.*$/, '');
    if (value === '' || value === 'null' || value === '~') data[key] = null;
    else if (/^\[.*\]$/.test(value)) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else data[key] = value.replace(/^["']|["']$/g, '');
  }
  return data;
}

function isDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function ageDays(v) {
  return (now - Date.parse(v)) / DAY;
}

function oneOf(file, fm, key, allowed, { required = true } = {}) {
  const v = fm[key];
  if (v === undefined || v === null) {
    if (required) err(file, `frontmatter \`${key}\` is missing`);
    return;
  }
  if (!allowed.includes(v)) {
    err(file, `frontmatter \`${key}: ${v}\` is not one of ${allowed.join(' | ')}`);
  }
}

/* --------------------------------------------------- 1. required structure */

const REQUIRED = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'docs/INDEX.md',
  'docs/log.md',
  'docs/idea.md',
  'docs/product/vision.md',
  'docs/product/scope.md',
  'docs/product/non-goals.md',
  'docs/product/personas.md',
  'docs/architecture/overview.md',
  'docs/ops/environments.md',
  'docs/ops/runbook.md',
  'docs/decisions/_template.md',
  'docs/decisions/0000-record-architecture-decisions.md',
  'docs/specs/_template/spec.md',
  '.claude/settings.json',
];

for (const f of REQUIRED) {
  if (!existsSync(join(ROOT, f))) err(f, 'required file is missing');
}

/* ------------------------------------------- 2. constitution stays readable */

if (existsSync(join(ROOT, 'AGENTS.md'))) {
  const lines = read(join(ROOT, 'AGENTS.md'), 'utf8').split('\n').length;
  if (lines > 200) {
    err('AGENTS.md', `${lines} lines, limit is 200. Move procedures into .claude/skills/.`);
  } else if (lines > 170) {
    warn('AGENTS.md', `${lines} lines, approaching the 200 line limit.`);
  }
  if (!read(join(ROOT, 'CLAUDE.md'), 'utf8').includes('@AGENTS.md')) {
    err('CLAUDE.md', 'must import the constitution with `@AGENTS.md`');
  }
}

/* ------------------------------------------------------- 3. collect the docs */

const docFiles = walk(DOCS).filter((f) => f.endsWith('.md'));
const NO_FRONTMATTER = new Set(['docs/INDEX.md', 'docs/log.md', 'docs/idea.md']);

const docs = new Map(); // relative path -> { text, fm, links }

for (const abs of docFiles) {
  const r = rel(abs);
  const text = read(abs, 'utf8');
  const fm = frontmatter(text);
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  docs.set(r, { abs, text, fm, links });

  if (!NO_FRONTMATTER.has(r) && !fm) {
    err(r, 'missing YAML frontmatter');
  }
}

/* ------------------------------------------------------------- 4. filenames */

for (const abs of [...docFiles, ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, '.claude'))]) {
  const name = basename(abs);
  if (name !== name.normalize('NFC')) err(rel(abs), 'filename is not NFC-normalized');
  if (/\s/.test(name)) err(rel(abs), 'filename contains whitespace, use kebab-case');
}

/* ------------------------------------------------------------------ 5. ADRs */

const ADR_STATUS = ['proposed', 'accepted', 'rejected', 'superseded', 'deprecated'];
const adrs = new Map(); // id -> { path, fm }

for (const [r, doc] of docs) {
  if (!r.startsWith('docs/decisions/') || !doc.fm) continue;
  const name = basename(r);
  if (name === '_template.md') continue;

  const m = name.match(/^(\d{4})-[a-z0-9-]+\.md$/);
  if (!m) {
    err(r, 'ADR filename must be `NNNN-kebab-title.md`');
    continue;
  }
  const id = m[1];

  if (doc.fm.type !== 'adr') err(r, 'frontmatter `type` must be `adr`');
  oneOf(r, doc.fm, 'status', ADR_STATUS);
  if (String(doc.fm.id) !== id) err(r, `frontmatter \`id: ${doc.fm.id}\` does not match filename \`${id}\``);
  if (!isDate(doc.fm.date)) err(r, 'frontmatter `date` must be YYYY-MM-DD');

  for (const section of ['## Context', '## Decision', '## Consequences']) {
    if (!doc.text.includes(section)) err(r, `missing required section \`${section}\``);
  }
  if (!/###\s*Negative/.test(doc.text)) {
    warn(r, 'no Negative consequences section. A decision with no downside was not a decision.');
  }

  if (doc.fm.status === 'proposed' && isDate(doc.fm.date) && ageDays(doc.fm.date) > 14) {
    warn(r, `proposed for ${Math.round(ageDays(doc.fm.date))} days. Decide it or withdraw it.`);
  }

  adrs.set(id, { path: r, fm: doc.fm });
}

for (const [id, { path, fm }] of adrs) {
  const supersededBy = fm.superseded_by;
  const supersedes = fm.supersedes;

  if (fm.status === 'superseded' && !supersededBy) {
    err(path, 'status is `superseded` but `superseded_by` is empty');
  }
  if (supersededBy) {
    const target = adrs.get(String(supersededBy));
    if (!target) err(path, `\`superseded_by: ${supersededBy}\` points at an ADR that does not exist`);
    else if (String(target.fm.supersedes) !== id) {
      err(target.path, `should declare \`supersedes: "${id}"\` to match ${path}`);
    }
    if (fm.status !== 'superseded') err(path, 'has `superseded_by` but status is not `superseded`');
  }
  if (supersedes) {
    const target = adrs.get(String(supersedes));
    if (!target) err(path, `\`supersedes: ${supersedes}\` points at an ADR that does not exist`);
    else if (String(target.fm.superseded_by) !== id) {
      err(target.path, `should declare \`superseded_by: "${id}"\` to match ${path}`);
    }
  }
}

/* ----------------------------------------------------------------- 6. specs */

const SPEC_STATUS = ['draft', 'approved', 'in-progress', 'done', 'dropped'];
const EARS = /^\s*(?:\d+\.\s*|[-*]\s*)?(When|While|If|Where|The system shall)\b/m;

for (const entry of existsSync(join(DOCS, 'specs')) ? readdirSync(join(DOCS, 'specs')) : []) {
  const dir = join(DOCS, 'specs', entry);
  if (!statSync(dir).isDirectory()) continue;
  if (entry === '_template') continue;

  if (!/^\d{4}-[a-z0-9-]+$/.test(entry)) {
    err(`docs/specs/${entry}`, 'spec directory must be named `NNNN-kebab-slug`');
    continue;
  }
  const specPath = `docs/specs/${entry}/spec.md`;
  const doc = docs.get(specPath);
  if (!doc) {
    err(`docs/specs/${entry}`, 'spec directory has no `spec.md`');
    continue;
  }
  const fm = doc.fm ?? {};
  const id = entry.slice(0, 4);

  if (fm.type !== 'spec') err(specPath, 'frontmatter `type` must be `spec`');
  oneOf(specPath, fm, 'status', SPEC_STATUS);
  if (String(fm.id) !== id) err(specPath, `frontmatter \`id: ${fm.id}\` does not match directory \`${id}\``);
  if (!isDate(fm.date)) err(specPath, 'frontmatter `date` must be YYYY-MM-DD');

  if (!doc.text.includes('## Acceptance criteria')) {
    err(specPath, 'missing `## Acceptance criteria`');
  } else {
    const section = doc.text.split('## Acceptance criteria')[1].split(/\n## /)[0];
    if (!EARS.test(section)) {
      err(
        specPath,
        'no acceptance criterion in EARS form. Start criteria with When / While / If / Where / The system shall.',
      );
    }
  }

  if (['in-progress', 'done'].includes(fm.status)) {
    if (!existsSync(join(dir, 'plan.md'))) err(specPath, `status is \`${fm.status}\` but there is no plan.md`);
    if (!existsSync(join(dir, 'tasks.md'))) err(specPath, `status is \`${fm.status}\` but there is no tasks.md`);
  }
  if (fm.status === 'approved' && /- \[ \]/.test(doc.text.split('## Open questions')[1] ?? '')) {
    err(specPath, 'status is `approved` but open questions remain unchecked');
  }
}

/* -------------------------------------------- 7. other docs, links, freshness */

const OTHER_STATUS = ['template', 'draft', 'stable', 'deprecated'];

for (const [r, doc] of docs) {
  if (!doc.fm || r.startsWith('docs/decisions/') || r.startsWith('docs/specs/')) continue;
  if (!['product', 'architecture', 'ops'].includes(doc.fm.type)) {
    err(r, `frontmatter \`type: ${doc.fm.type}\` must be product | architecture | ops`);
  }
  oneOf(r, doc.fm, 'status', OTHER_STATUS);
  if (!isDate(doc.fm.last_verified)) err(r, 'frontmatter `last_verified` must be YYYY-MM-DD');
  else if (doc.fm.status === 'stable' && ageDays(doc.fm.last_verified) > 180) {
    warn(r, `stable but last verified ${Math.round(ageDays(doc.fm.last_verified))} days ago. Re-read it.`);
  }
  if (doc.fm.status === 'template') {
    warn(r, 'still a template. `/onboard` should have filled this in.');
  }
}

// Broken relative links.
for (const [r, doc] of docs) {
  for (const link of doc.links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const clean = decodeURI(link.split('#')[0]).trim();
    if (!clean) continue;
    const target = resolve(dirname(join(ROOT, r)), clean);
    if (!existsSync(target)) err(r, `broken link to \`${link}\``);
  }
}

// Discoverability: every document must be reachable from docs/INDEX.md.
const index = docs.get('docs/INDEX.md');
if (index) {
  const reachable = new Set(['docs/INDEX.md']);
  const queue = ['docs/INDEX.md'];
  while (queue.length) {
    const current = queue.shift();
    const doc = docs.get(current);
    if (!doc) continue;
    for (const link of doc.links) {
      if (/^(https?:|mailto:|#)/.test(link)) continue;
      const clean = decodeURI(link.split('#')[0]).trim();
      if (!clean) continue;
      const target = rel(resolve(dirname(join(ROOT, current)), clean));
      if (docs.has(target) && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  for (const r of docs.keys()) {
    if (!reachable.has(r)) {
      err(r, 'not reachable from docs/INDEX.md. Add a line to the index in this same change.');
    }
  }
}

/* --------------------------------------------------- 8. secrets and leftovers */

const SECRETS = [
  [/\b(?:sk|pk)-[A-Za-z0-9]{16,}/, 'API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9!@#$%^&*_-]{12,}/i, 'credential'],
];

const scan = [...docFiles, join(ROOT, 'AGENTS.md'), join(ROOT, 'README.md')].filter((f) => existsSync(f));
for (const abs of scan) {
  const text = read(abs, 'utf8');
  for (const [re, label] of SECRETS) {
    if (re.test(text)) err(rel(abs), `looks like a committed ${label}. Move it to the secret manager.`);
  }
}

for (const [r, doc] of docs) {
  if (doc.fm?.status === 'template') continue;
  const todos = (doc.text.match(/\b(TODO|FIXME|XXX)\b/g) ?? []).length;
  if (todos) warn(r, `${todos} TODO/FIXME marker(s). Move them into a spec's tasks.md or drop them.`);
}

/* ------------------------------------------- 8b. the .claude/ surface itself */

// Rules, skills and commands are context. Malformed ones fail silently at runtime, which is the
// worst way for a guardrail to fail, so check them here.

for (const abs of walk(join(ROOT, '.claude/rules')).filter((f) => f.endsWith('.md'))) {
  const r = rel(abs);
  const fm = frontmatter(read(abs, 'utf8'));
  if (!fm) {
    err(r, 'rule has no frontmatter, so it loads into every session unconditionally. Add `paths`.');
    continue;
  }
  if (!('paths' in fm)) {
    warn(
      r,
      'no `paths` field, so this rule loads into every session and costs context every time. ' +
        'Scope it, or move it into AGENTS.md if it really is universal.',
    );
  }
  if (!fm.description) warn(r, 'no `description` field');
}

for (const abs of walk(join(ROOT, '.claude/skills')).filter((f) => f.endsWith('SKILL.md'))) {
  const r = rel(abs);
  const fm = frontmatter(read(abs, 'utf8'));
  if (!fm) {
    err(r, 'skill has no frontmatter. It needs `name` and `description` to be discoverable.');
    continue;
  }
  if (!fm.name) err(r, 'skill is missing `name`');
  if (!fm.description) err(r, 'skill is missing `description`, so it will never trigger');
  const dir = basename(dirname(abs));
  if (fm.name && fm.name !== dir) err(r, `skill \`name: ${fm.name}\` does not match its directory \`${dir}\``);
}

for (const abs of walk(join(ROOT, '.claude/commands')).filter((f) => f.endsWith('.md'))) {
  const r = rel(abs);
  const fm = frontmatter(read(abs, 'utf8'));
  if (!fm?.description) warn(r, 'command has no `description`, so it shows unlabelled in the menu');
}

if (existsSync(join(ROOT, '.claude/settings.json'))) {
  try {
    const s = JSON.parse(read(join(ROOT, '.claude/settings.json'), 'utf8'));
    for (const [event, entries] of Object.entries(s.hooks ?? {})) {
      for (const entry of entries) {
        for (const h of entry.hooks ?? []) {
          const m = String(h.command ?? '').match(/(\.claude\/hooks\/[\w.-]+)/);
          if (m && !existsSync(join(ROOT, m[1]))) {
            err('.claude/settings.json', `${event} hook points at \`${m[1]}\`, which does not exist`);
          }
        }
      }
    }
  } catch (e) {
    err('.claude/settings.json', `is not valid JSON: ${e.message}`);
  }
}

/* ---------------------------------------------------------------- 9. report */

const label = (list) => list.map(({ file, msg }) => `  ${file}: ${msg}`).join('\n');

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  console.log(label(warnings));
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  console.log(label(errors));
  console.log(`\nlint-docs failed. ${errors.length} error(s), ${warnings.length} warning(s).\n`);
  process.exit(1);
}
console.log(`\nlint-docs passed. ${docs.size} documents, ${adrs.size} ADR(s), ${warnings.length} warning(s). (${today})\n`);

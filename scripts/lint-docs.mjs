#!/usr/bin/env node
/**
 * Documentation gate.
 *
 * Prose reminders in an instruction file do not survive a long agent session. This does.
 * Run locally with `npm run lint:docs`; CI runs it on every pull request.
 *
 * Errors fail the build. Warnings are printed and do not.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';
import { loadGates, stage, blocking, STAGES, globToRegExp } from './changed-files.mjs';

import { validateTracks } from './tracks.mjs';

const args = process.argv.slice(2);
const UPDATE_BASELINE = args.includes('--update-baseline');
const ROOT = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
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

/** Body of a heading, up to the next heading of the same or higher level. */
function section(text, heading) {
  const level = heading.match(/^#+/)[0].length;
  const i = text.indexOf(`${heading}\n`);
  if (i === -1) return null;
  const rest = text.slice(i + heading.length);
  const next = rest.search(new RegExp(`\\n#{1,${level}}\\s`));
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

/** Strip markdown furniture so length means prose, not pipes and dashes. */
const prose = (s) => (s ?? '').replace(/[|#>*`[\]()_-]/g, ' ').replace(/\s+/g, ' ').trim();

const PLACEHOLDER = /\b(TBD|NNNN|YYYY-MM-DD)\b/;

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
  'docs/product/non-goals.md',
  'docs/architecture/overview.md',
  'docs/ops/environments.md',
  'docs/decisions/_template.md',
  'docs/decisions/0000-record-architecture-decisions.md',
  'docs/specs/_template/spec.md',
  '.claude/settings.json',
];

// Useful for most projects, pointless for some. An internal tool with one user does not need
// personas, and a stateless service does not need a data model. Deleting one is fine; the index
// link check makes sure the index stops pointing at it.
const EXPECTED = [
  'docs/product/scope.md',
  'docs/product/personas.md',
  'docs/architecture/data-model.md',
];

for (const f of REQUIRED) {
  if (!existsSync(join(ROOT, f))) err(f, 'required file is missing');
}
for (const f of EXPECTED) {
  if (!existsSync(join(ROOT, f))) {
    warn(f, 'missing. Fine if this project genuinely does not need it, otherwise restore it.');
  }
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

// A leading underscore marks a template stub: shipped as a starting shape, renamed into place by
// /onboard or /harden when the project actually needs it. Stubs are not project documents, so they
// are not required to be reachable, do not carry a status, and are not validated as ADRs or specs.
const isStub = (p) => basename(p).startsWith('_');

const docFiles = walk(DOCS)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => !isStub(f));
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
  if (name.startsWith('_')) continue;

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


  // Existence is cheap to fake. These checks do not judge whether a decision is good, but they
  // do catch the empty shell written to get past the gate.
  if (PLACEHOLDER.test(doc.text)) {
    err(r, 'still contains placeholder text (TBD / NNNN / YYYY-MM-DD) from the template');
  }

  const context = prose(section(doc.text, '## Context'));
  if (context.length < 200) {
    err(
      r,
      `Context is ${context.length} characters of prose, minimum is 200. It is the one section ` +
        'that cannot be reconstructed from the code: name the constraint that forced the choice.',
    );
  }

  const decision = prose(section(doc.text, '## Decision'));
  if (decision.length < 40) err(r, 'Decision section is essentially empty');

  const options = section(doc.text, '## Options considered');
  if (options) {
    const rows = options
      .split('\n')
      .filter((l) => /^\|/.test(l) && !/^\|[\s|:-]+\|$/.test(l))
      .slice(1);
    if (rows.length < 2) {
      err(r, `Options considered lists ${rows.length} option(s). A decision with one option was not a decision.`);
    }
  } else {
    warn(r, 'no `## Options considered` section');
  }

  const negative = section(doc.text, '### Negative');
  const negBullets = (negative ?? '')
    .split('\n')
    .filter((l) => /^\s*[-*]\s+/.test(l) && prose(l).length > 20);
  if (negBullets.length === 0) {
    err(r, 'no substantive negative consequence. Every real decision costs something; name it.');
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

// A supersede chain that loops back on itself leaves no record in force: every one of them claims
// to be replaced by another. The pairwise checks above cannot see it, because each link is
// consistent on its own.
for (const [start] of adrs) {
  const seen = new Set([start]);
  let cur = adrs.get(start)?.fm.superseded_by;
  while (cur) {
    const id = String(cur);
    if (seen.has(id)) {
      err(adrs.get(start).path, `supersede chain loops back on itself through ${[...seen, id].join(' -> ')}, so no record in it is in force`);
      break;
    }
    seen.add(id);
    cur = adrs.get(id)?.fm.superseded_by;
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

  if (['approved', 'in-progress', 'done'].includes(fm.status) && PLACEHOLDER.test(doc.text)) {
    err(specPath, `status is \`${fm.status}\` but the spec still contains template placeholders`);
  }

  // Security is part of the requirement, not a review afterthought. An approved spec says what it
  // changes for the threat model, or in a sentence why it changes nothing.
  if (['approved', 'in-progress', 'done'].includes(fm.status)) {
    const sec = section(doc.text, '## Security');
    if (sec === null) err(specPath, `status is \`${fm.status}\` but there is no \`## Security\` section`);
    else if (prose(sec).length < 20) {
      err(specPath, '`## Security` is empty. State the threat-model impact and abuse cases, or why there is none.');
    }
  }

  // UI is built to an approved design, not improvised. A UI spec cannot be approved before the
  // design system is, which is what puts /design in front of the first frontend work.
  if (String(fm.ui) === 'true' && ['approved', 'in-progress', 'done'].includes(fm.status)) {
    const designPath = join(DOCS, 'design/system.md');
    const design = existsSync(designPath) ? frontmatter(read(designPath)) : null;
    if (!design) {
      err(specPath, 'is a UI spec (`ui: true`) but there is no `docs/design/system.md`. Run /design before approving it.');
    } else if (design.status !== 'stable') {
      err(specPath, `is a UI spec but the design system is \`${design.status}\`, not approved. Finish /design first.`);
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
  if (!['product', 'architecture', 'ops', 'security', 'design'].includes(doc.fm.type)) {
    err(r, `frontmatter \`type: ${doc.fm.type}\` must be product | architecture | ops | security | design`);
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

// Subagents carry their own hooks in frontmatter. The runtime does not complain when one points at
// a missing script or an unconfigured scope profile; it just refuses, or allows, in silence.
const gatesForAgents = (() => {
  try {
    return JSON.parse(read(join(ROOT, '.claude/gates.json')));
  } catch {
    return {};
  }
})();
for (const abs of walk(join(ROOT, '.claude/agents')).filter((f) => f.endsWith('.md'))) {
  const r = rel(abs);
  const text = read(abs);
  const head = text.startsWith('---') ? text.slice(0, text.indexOf('\n---', 3) + 1) : '';
  if (!head) {
    err(r, 'agent has no frontmatter, so it has no name, description or tool list');
    continue;
  }
  for (const m of head.matchAll(/(\.claude\/hooks\/[\w.-]+)/g)) {
    if (!existsSync(join(ROOT, m[1]))) err(r, `frontmatter hook points at \`${m[1]}\`, which does not exist`);
  }
  const scopes = [...head.matchAll(/agent-scope\.mjs\\?"?\s+([\w-]+)/g)].map((m) => m[1]);
  for (const name of new Set(scopes)) {
    if (!gatesForAgents.agentScopes?.[name]) {
      err(r, `uses scope profile \`${name}\`, which \`agentScopes\` in .claude/gates.json does not define, so every call is refused`);
    }
  }
  const tools = (head.match(/^tools:\s*(.*)$/m) ?? [])[1] ?? '';
  if (/\b(Write|Edit|Bash)\b/.test(tools) && scopes.length === 0) {
    warn(r, 'can write or run commands but has no agent-scope hook, so nothing keeps it inside its role');
  }
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

/* ------------------------------------------- 8c. onboarding state consistency */

if (existsSync(join(ROOT, '.claude/onboarding.json'))) {
  const f = '.claude/onboarding.json';
  try {
    const s = JSON.parse(read(join(ROOT, f)));
    const STATES = ['not-started', 'in-progress', 'completed'];
    if (!STATES.includes(s.status)) {
      err(f, `\`status: ${s.status}\` is not one of ${STATES.join(' | ')}`);
    }
    if (s.status === 'in-progress' && !s.phase) warn(f, 'in progress but records no phase to resume from');

    if (s.status === 'completed') {
      const agents = existsSync(join(ROOT, 'AGENTS.md')) ? read(join(ROOT, 'AGENTS.md')) : '';
      if (agents.includes('Stage: pre-onboarding')) {
        err(f, 'says onboarding completed, but AGENTS.md still says `Stage: pre-onboarding`');
      }
      if (agents.includes('TBD after onboarding')) {
        err('AGENTS.md', 'Commands table still says "TBD after onboarding" after onboarding completed');
      }
      if (agents.includes('<!-- onboard:')) {
        warn('AGENTS.md', 'still has onboarding placeholder markers; remove them once filled');
      }
      if (!existsSync(join(ROOT, 'docs/security/threat-model.md'))) {
        err(f, 'onboarding is marked complete but `docs/security/threat-model.md` does not exist. Phase 3 writes it.');
      }
      const guidance = join(ROOT, '.claude/claude-security-guidance.md');
      if (existsSync(guidance) && read(guidance).includes('replaces this stub')) {
        warn('.claude/claude-security-guidance.md', 'still the template stub, so the security plugin reviews without this project\'s rules');
      }
      // A placeholder rule or skill left after onboarding is a rule nobody wrote: the agent reads
      // "PLACEHOLDER" as the standard and writes code to no standard at all.
      for (const dir of ['.claude/rules', '.claude/skills']) {
        for (const abs of walk(join(ROOT, dir)).filter((x) => x.endsWith('.md'))) {
          const fm = frontmatter(read(abs));
          if (fm?.description && /PLACEHOLDER/.test(fm.description)) {
            warn(rel(abs), 'still a placeholder after onboarding. Fill it from the stack pack, or delete it if the project does not need it.');
          }
        }
      }
      if (s.agreedButNotWritten?.length) {
        err(f, `onboarding is marked complete but ${s.agreedButNotWritten.length} decision(s) are still unwritten`);
      }
    }
  } catch (e) {
    err(f, `is not valid JSON: ${e.message}`);
  }
}

if (existsSync(join(ROOT, '.claude/gates.json'))) {
  const f = '.claude/gates.json';
  try {
    const g = JSON.parse(read(join(ROOT, f)));

    // `stage` must be declared, not inherited from the code's default. It went missing once and
    // nothing noticed for a day: every check stayed green, the documentation claiming the key
    // exists stayed wrong, and the knob was undiscoverable. A default that hides its own absence
    // is worse than no default.
    if (!('stage' in g)) {
      err(f, 'does not declare `stage`. The gates would fall back to `building` silently, which is exactly how this key went missing before.');
    } else if (!STAGES.includes(g.stage)) {
      err(f, `\`stage: ${g.stage}\` is not one of ${STAGES.join(' | ')}`);
    }

    for (const key of ['sourcePaths', 'manifests', 'guardrails', 'secretPaths']) {
      if (key in g && (!Array.isArray(g[key]) || g[key].length === 0)) {
        err(f, `\`${key}\` is present but empty, so everything it gates is silently unchecked`);
      }
    }

    if ('infra' in g) {
      for (const key of ['paths', 'foundations']) {
        if (key in g.infra && (!Array.isArray(g.infra[key]) || g.infra[key].length === 0)) {
          err(f, `\`infra.${key}\` is present but empty, so everything it gates is silently unchecked`);
        }
      }
      const light = g.infra.lightBootstrapMaxComponents;
      if (light !== undefined && !(Number.isInteger(light) && light >= 0)) {
        err(f, `\`infra.lightBootstrapMaxComponents: ${light}\` must be a whole number, 0 to always run the full pipeline`);
      }
    }
    for (const [name, p] of Object.entries(g.agentScopes ?? {})) {
      if (name.startsWith('$')) continue;
      if (!Array.isArray(p.write) || !Array.isArray(p.bash)) {
        err(f, `\`agentScopes.${name}\` needs \`write\` and \`bash\` arrays (empty means none allowed)`);
      }
    }

    // Source paths that match nothing gate nothing, and report success while doing it. This is the
    // follow-up ADR 0002 named for the failure it created: defaults describing a JavaScript layout
    // silently stop noticing source changes on a project that is not JavaScript.
    //
    // One warning, not one per glob, and only for `sourcePaths`. `manifests` deliberately lists
    // several ecosystems and most will never match; warning per entry would bury the signal under
    // its own noise, which is the failure this check exists to prevent.
    const sourceGlobs = Array.isArray(g.sourcePaths) ? g.sourcePaths : [];
    if (sourceGlobs.length) {
      const repoFiles = walk(ROOT).map((p) => rel(p));
      const matched = sourceGlobs.filter((glob) => {
        const re = globToRegExp(glob);
        return repoFiles.some((file) => re.test(file));
      });
      if (matched.length === 0) {
        warn(
          f,
          '`sourcePaths` matches no file in this repository, so the Stop hook notices no source ' +
            'change at all. Expected before there is code; a silent hole once there is.',
        );
      }
    }

  } catch (e) {
    err(f, `is not valid JSON, so the gates fell back to defaults silently: ${e.message}`);
  }
}

// The security plugin appends this file to every review prompt and cuts it at 8 KB, silently.
{
  const guidance = join(ROOT, '.claude/claude-security-guidance.md');
  if (existsSync(guidance) && statSync(guidance).size > 8192) {
    warn('.claude/claude-security-guidance.md', `${statSync(guidance).size} bytes; the plugin truncates past 8192, so the last rules are never read`);
  }
}

/* ------------------------------------------------- 8d. fixes that must stay */

// A fix an agent does not know the reason for is a fix it will "simplify" away, and nothing fails:
// the code still runs, it just runs the old bug again. Each marker names a string that has to stay
// in a file for as long as the fix exists. Removing one is a change to gates.json, which is a
// guardrail, so the ADR gate asks why.
{
  const g = (() => {
    try {
      return JSON.parse(read(join(ROOT, '.claude/gates.json')));
    } catch {
      return {};
    }
  })();
  const markers = g.markers ?? [];
  if (!Array.isArray(markers)) err('.claude/gates.json', '`markers` must be an array');
  else {
    const ids = new Set();
    for (const m of markers) {
      const label = `marker \`${m?.id ?? '?'}\``;
      if (!m?.id || !m?.file || !m?.marker || !m?.why) {
        err('.claude/gates.json', `${label} needs \`id\`, \`file\`, \`marker\` and \`why\``);
        continue;
      }
      if (ids.has(m.id)) err('.claude/gates.json', `${label} is declared twice`);
      ids.add(m.id);
      const abs = join(ROOT, m.file);
      if (!existsSync(abs)) {
        err(m.file, `${label} guards a file that no longer exists. Why it mattered: ${m.why}`);
      } else if (!read(abs).includes(m.marker)) {
        err(
          m.file,
          `${label} is gone: \`${m.marker}\` no longer appears. Why it mattered: ${m.why} ` +
            'If the fix moved, move the marker; if it is genuinely obsolete, remove the marker with an ADR.',
        );
      }
    }
  }
}

/* ------------------------------------------------------- 8e. warning ratchet */

// Warnings that only print are read for about a week and then ignored, and a new one arrives
// unnoticed among the old ones. Once a baseline exists, the count may fall but not rise.
// `--update-baseline` lowers it after a cleanup, and creates it; it never raises it. Raising it is
// a hand edit, visible in review, which is the point.
const BASELINE = join(ROOT, '.claude/lint-baseline.json');
{
  let baseline = null;
  if (existsSync(BASELINE)) {
    try {
      baseline = JSON.parse(read(BASELINE)).warnings;
      if (!Number.isInteger(baseline) || baseline < 0) {
        err('.claude/lint-baseline.json', '`warnings` must be a whole number');
        baseline = null;
      }
    } catch (e) {
      err('.claude/lint-baseline.json', `is not valid JSON: ${e.message}`);
    }
  }
  const count = warnings.length;
  if (UPDATE_BASELINE) {
    if (baseline === null || count < baseline) {
      writeFileSync(BASELINE, `${JSON.stringify({ warnings: count }, null, 2)}\n`);
      console.log(`lint baseline ${baseline === null ? 'created at' : `lowered from ${baseline} to`} ${count} warning(s).`);
      baseline = count;
    } else if (count > baseline) {
      console.log(`lint baseline not raised: ${count} warning(s) against ${baseline}. Fix them, or raise it by hand in review.`);
    }
  }
  if (baseline !== null && count > baseline) {
    err(
      '.claude/lint-baseline.json',
      `warnings rose from ${baseline} to ${count}. The new ones are listed above. Fix them rather than ` +
        'raising the baseline; if one is genuinely acceptable, raise it by hand and say why in the PR.',
    );
  } else if (baseline !== null && count < baseline && !UPDATE_BASELINE) {
    console.log(`\n${baseline - count} fewer warning(s) than the baseline. Lock it in: npm run lint:docs -- --update-baseline`);
  }
}

for (const message of validateTracks(ROOT)) err('.claude/tracks.json', message);

/* ---------------------------------------------------------------- 9. report */

const label = (list) => list.map(({ file, msg }) => `  ${file}: ${msg}`).join('\n');

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  console.log(label(warnings));
}
const gates = loadGates(ROOT);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  console.log(label(errors));
  if (!blocking(gates)) {
    console.log(
      `\nlint-docs is advisory at stage \`${stage(gates)}\`: the errors above are real and are not ` +
        'blocking anything. Run /harden once the project should start holding itself to them.\n',
    );
    process.exit(0);
  }
  console.log(`\nlint-docs failed. ${errors.length} error(s), ${warnings.length} warning(s).\n`);
  process.exit(1);
}
console.log(
  `\nlint-docs passed. ${docs.size} documents, ${adrs.size} ADR(s), ${warnings.length} warning(s). ` +
    `stage=${stage(gates)} (${today})\n`,
);

/**
 * One definition of "what changed", shared by the CI gate and the Stop hook.
 *
 * They disagreed before this existed: the hook looked only at the working tree, so an agent that
 * committed its work and then stopped walked straight past it. A guardrail that two callers
 * implement separately is a guardrail with two different behaviors.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

export function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function inRepo() {
  return Boolean(git('rev-parse --is-inside-work-tree'));
}

/**
 * Parse `git status --porcelain` into paths.
 * The status field is two columns followed by a space, but leading whitespace is significant and
 * easy to lose to a trim, so match rather than slice. Renames appear as `old -> new`.
 */
export function parsePorcelain(raw) {
  return (raw ?? '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^\s*\S{1,2}\s+(.*)$/);
      if (!m) return null;
      const path = m[1].includes(' -> ') ? m[1].split(' -> ').pop() : m[1];
      return path.replace(/^"|"$/g, '').trim();
    })
    .filter(Boolean);
}

export function resolveBase(explicit) {
  if (explicit && git(`rev-parse --verify ${explicit}`)) return explicit;
  const candidate = ['origin/main', 'origin/master', 'main', 'master'].find((r) =>
    git(`rev-parse --verify ${r}`),
  );
  if (candidate) return candidate;
  return git('rev-parse --verify HEAD~1') ? 'HEAD~1' : null;
}

/**
 * Every path this branch touches relative to its base: committed work plus anything still
 * uncommitted. Committing is not a way out of the gate.
 */
export function changedFiles({ base: explicitBase } = {}) {
  if (!inRepo()) return { base: null, files: [], reason: 'not a git repository' };

  const base = resolveBase(explicitBase);
  // `--untracked-files=all`, or a brand-new directory is reported as `infra/` rather than the files
  // inside it, and any glob that names a file (`**/backend.tf`) never sees them.
  const working = parsePorcelain(git('status --porcelain --untracked-files=all'));

  if (!base) {
    return { base: null, files: working, reason: 'no base commit to compare against yet' };
  }

  const mergeBase = git(`merge-base ${base} HEAD`) ?? base;
  const committed = (git(`diff --name-only ${mergeBase} HEAD`) ?? '').split('\n').filter(Boolean);

  return { base, files: [...new Set([...committed, ...working])], reason: null };
}

/**
 * Minimal glob matcher. No dependency is worth adding for this, and the gates must keep working
 * before any stack exists. Supports `**`, `*` and `?`; everything else is literal.
 */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        // `**/` also matches zero directories, so `**/.env` matches a bare `.env`.
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') out += '[^/]';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(path, globs) {
  return globs.some((g) => globToRegExp(g).test(path));
}

/** Gate tuning. Missing or malformed config falls back to the defaults rather than failing open. */
export function loadGates(root = '.') {
  const defaults = {
    stage: 'building',
    sourcePaths: ['src/**', 'app/**', 'lib/**', 'server/**', 'packages/**', 'api/**', 'components/**'],
    manifests: ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json'],
    guardrails: ['scripts/*.mjs', '.github/workflows/**', '.claude/settings.json', '.claude/gates.json', '.claude/hooks/**'],
    stopHook: { sourceFilesWithoutSpec: 3, requireLogEntry: true, requireAdrForGuardrails: true },
    secretPaths: ['**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/id_rsa*'],
    secretPathAllowlist: ['**/.env.example', '**/.env.sample', '**/.env.template'],
    infra: { paths: ['infra/**', '**/*.tf', '**/*.tfvars', '**/*.hcl'], foundations: [] },
    agentScopes: {},
  };
  const file = `${root}/.claude/gates.json`;
  if (!existsSync(file)) return defaults;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return {
      ...defaults,
      ...parsed,
      stopHook: { ...defaults.stopHook, ...(parsed.stopHook ?? {}) },
      infra: { ...defaults.infra, ...(parsed.infra ?? {}) },
    };
  } catch {
    return defaults;
  }
}

/** Paths whose change means a decision was made, grouped so the message can say which. */
export function classify(files, gates = loadGates()) {
  return {
    architecture: files.filter((f) => /^docs\/architecture\/.+\.md$/.test(f)),
    manifests: files.filter((f) => matchesAny(f, gates.manifests)),
    nonGoals: files.filter((f) => f === 'docs/product/non-goals.md'),
    guardrails: files.filter((f) => matchesAny(f, gates.guardrails)),
    adrs: files.filter((f) => /^docs\/decisions\/\d{4}-.+\.md$/.test(f)),
    specs: files.filter((f) => /^docs\/specs\/\d{4}-/.test(f)),
    log: files.filter((f) => f === 'docs/log.md'),
    source: files.filter((f) => matchesAny(f, gates.sourcePaths)),
    infra: files.filter((f) => matchesAny(f, gates.infra.paths)),
    // Files that fix the shape of the infrastructure rather than its contents: state backend, root
    // configuration, one environment or account. Editing a module is a change; moving one of these
    // is a decision.
    infraFoundations: files.filter((f) => matchesAny(f, gates.infra.foundations)),
  };
}

/**
 * Gate stages. A fresh project that is still finding its shape should not have pull requests
 * blocked for a missing decision record about code that may not exist next week; a project past
 * that point should. One flag, three gates read it.
 *
 * `exploration` reports everything and blocks nothing. Safety checks are not part of this: the
 * secret guard runs at every stage, because leaking a credential is not a process question.
 */
export const STAGES = ['exploration', 'building', 'production'];

export function stage(gates = loadGates()) {
  return STAGES.includes(gates.stage) ? gates.stage : 'building';
}

export function blocking(gates = loadGates()) {
  return stage(gates) !== 'exploration';
}

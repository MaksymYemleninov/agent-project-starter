/**
 * One definition of "what changed", shared by the CI gate and the Stop hook.
 *
 * They disagreed before this existed: the hook looked only at the working tree, so an agent that
 * committed its work and then stopped walked straight past it. A guardrail that two callers
 * implement separately is a guardrail with two different behaviors.
 */
import { execSync } from 'node:child_process';

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
  const working = parsePorcelain(git('status --porcelain'));

  if (!base) {
    return { base: null, files: working, reason: 'no base commit to compare against yet' };
  }

  const mergeBase = git(`merge-base ${base} HEAD`) ?? base;
  const committed = (git(`diff --name-only ${mergeBase} HEAD`) ?? '').split('\n').filter(Boolean);

  return { base, files: [...new Set([...committed, ...working])], reason: null };
}

/** Paths whose change means a decision was made, grouped so the message can say which. */
export function classify(files) {
  const MANIFESTS =
    /^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile|composer\.json)$/;
  const GUARDRAILS =
    /^(scripts\/(lint-docs|check-adr-drift|changed-files)\.mjs|\.github\/workflows\/.+|\.claude\/(settings\.json|hooks\/.+))$/;

  return {
    architecture: files.filter((f) => /^docs\/architecture\/.+\.md$/.test(f)),
    manifests: files.filter((f) => MANIFESTS.test(f)),
    nonGoals: files.filter((f) => f === 'docs/product/non-goals.md'),
    guardrails: files.filter((f) => GUARDRAILS.test(f)),
    adrs: files.filter((f) => /^docs\/decisions\/\d{4}-.+\.md$/.test(f)),
    specs: files.filter((f) => /^docs\/specs\/\d{4}-/.test(f)),
    log: files.filter((f) => f === 'docs/log.md'),
    source: files.filter((f) => /^(src|app|lib|server|packages|api|components)\//.test(f)),
  };
}

/**
 * The documentation rule and the escape reasons, in one place.
 *
 * The Stop hook and the CI gate used to hold two versions of "this change needed docs", and the
 * constitution claimed a third that neither enforced. One function now decides, and both call it:
 * a change that passes one passes the other. See docs/specs/0002-docs-gate-policy/spec.md.
 */
import { classify } from './changed-files.mjs';

export const MIN_REASON = 20;

/**
 * Documentation gaps for a change, as `{ kind, message }`. Proportionate on purpose: a one-file fix
 * needs nothing, a new file needs a log line, a change across the threshold needs a spec or a
 * decision record plus the log line. Deletions and exact moves count neither toward the threshold
 * nor as new files.
 */
export function docsGaps(change, gates) {
  const policy = { filesWithoutSpec: 3, logForNewFiles: true, ...(gates.docs ?? {}) };
  const renamed = change.renamedTo ?? new Set();
  // Only real documents count as the documentation: a spec's own files and existing-format ADRs,
  // added or modified. A junk file dropped into a spec directory is not a spec.
  const live = change.changes.filter((c) => ['A', 'M', 'T'].includes(c.status)).map((c) => c.path);
  const specs = live.filter((p) => /^docs\/specs\/\d{4}-[^/]+\/(spec|plan|tasks)\.md$/.test(p));
  const touched = classify(live, gates);
  // Deleting code is not new code: removals do not count toward the threshold, and a moved file
  // is a move, not an addition.
  const built = [...new Set([...touched.source, ...touched.infra])];
  const added = change.changes
    .filter((x) => x.status === 'A' && !renamed.has(x.path))
    .map((x) => x.path)
    .filter((p) => built.includes(p));
  const counted = built.filter((p) => !renamed.has(p));

  const gaps = [];
  const overThreshold = counted.length >= policy.filesWithoutSpec;
  if (overThreshold && specs.length === 0 && touched.adrs.length === 0) {
    gaps.push({
      kind: 'spec',
      message:
        `${counted.length} source or infrastructure files changed (threshold ${policy.filesWithoutSpec}, ` +
        '`docs.filesWithoutSpec` in `.claude/gates.json`) with no spec and no ADR added or modified. ' +
        'Name the spec that covers it, or write one.',
    });
  }
  const needsLog = overThreshold || (policy.logForNewFiles && added.length > 0);
  if (needsLog && touched.log.length === 0) {
    gaps.push({
      kind: 'log',
      message:
        (added.length ? `New file(s) ${added.slice(0, 5).join(', ')}${added.length > 5 ? ', ...' : ''}` : 'This change') +
        ' with no entry in `docs/log.md`. Add 3 to 6 bullets: what changed and where.',
    });
  }
  return gaps;
}

const LINES = { docs: 'No-docs-reason', adr: 'No-ADR-reason' };
const VARS = { docs: 'SKIP_DOCS_CHECK', adr: 'SKIP_ADR_CHECK' };

/**
 * The written reason for skipping a gate, from the local variable or from a line in the pull
 * request body (`PR_BODY`, passed by the workflow through `env`, never interpolated into a shell).
 * Returns `{ reason, source }`, `{ error }` for a reason that is present but too short, or `null`.
 * A label is not a reason: it says someone wanted to skip, not why.
 */
export function escapeReason(kind, env = process.env) {
  const local = env[VARS[kind]];
  if (local !== undefined && local !== '') {
    return isReason(local)
      ? { reason: local.trim(), source: VARS[kind] }
      : { error: `${VARS[kind]} needs a reason: at least ${MIN_REASON} characters and a few words, not a flag.` };
  }
  // Hidden text is no reason: a reviewer must be able to read what they might dispute, so HTML
  // comments are removed from the whole description before looking, not just from one line.
  // Fenced code is removed too: a description that shows the syntax as an example is not using it.
  const body = String(env.PR_BODY ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '');
  const candidates = [...body.matchAll(new RegExp(`^[ \\t]*${LINES[kind]}:[ \\t]*(.*)$`, 'gmi'))]
    .map((m) => m[1].trim())
    .filter(Boolean);
  if (!candidates.length) return null;
  const good = candidates.find(isReason);
  return good
    ? { reason: good, source: `${LINES[kind]} in the pull request description` }
    : { error: `\`${LINES[kind]}:\` in the pull request description needs a reason: at least ${MIN_REASON} characters and a few words.` };
}

/** Long enough, and made of words: twenty dots is not a reason. */
function isReason(text) {
  const t = String(text).trim();
  return t.length >= MIN_REASON && (t.match(/\p{L}{3,}/gu) ?? []).length >= 3;
}

export const escapeHint = (kind) =>
  `add a line \`${LINES[kind]}: <why, at least ${MIN_REASON} characters>\` to the pull request description ` +
  '(editing it starts a new CI run; "Re-run jobs" on an old run still sees the old description), ' +
  `or locally run with ${VARS[kind]}="<why>".`;

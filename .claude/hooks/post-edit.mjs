#!/usr/bin/env node
// PostToolUse hook: when a file that encodes an architectural commitment is touched,
// say so immediately rather than hoping the agent remembers at the end of the session.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hooks may run from anywhere. Anchor to the project, or every relative path below silently
// resolves against the wrong directory and the hook goes quiet instead of failing loudly.
const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  process.chdir(projectDir);
} catch {
  process.exit(0);
}

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const file = payload?.tool_input?.file_path ?? '';
if (!file) process.exit(0);

const rel = file.replace(process.cwd() + '/', '');
const notes = [];

if (/^docs\/architecture\//.test(rel)) {
  notes.push(
    `\`${rel}\` describes an architectural commitment. If this edit changes the shape of the system ` +
      'rather than wording, it needs an ADR in `docs/decisions/` in this same change. ' +
      '`npm run check:adr` will fail the pull request otherwise.',
  );
}

if (/^(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile)$/.test(rel)) {
  notes.push(
    `\`${rel}\` is a dependency manifest. A new runtime dependency is a decision: record it as an ADR ` +
      '(what it replaces, what it costs, how hard it is to remove).',
  );
}

if (/^docs\/product\/non-goals\.md$/.test(rel)) {
  notes.push(
    'Non-goals are binding under `AGENTS.md` section 2.3. Loosening one requires an ADR that ' +
      'supersedes it, and the human has to agree first.',
  );
}

if (/^docs\/specs\/\d{4}-/.test(rel) && rel.endsWith('spec.md')) {
  notes.push(
    'Spec changed. Check that `docs/INDEX.md` lists it and that acceptance criteria are still in ' +
      'EARS form (When / While / If / Where / The system shall).',
  );
}

if (notes.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: notes.join('\n'),
      },
    }),
  );
}
process.exit(0);

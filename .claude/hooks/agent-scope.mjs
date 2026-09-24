#!/usr/bin/env node
// PreToolUse hook, wired from a subagent's own frontmatter: keep each agent inside its lane.
//
//   node "$CLAUDE_PROJECT_DIR/.claude/hooks/agent-scope.mjs" <profile>
//
// `tools:` in an agent's frontmatter says which tools it may call, not what it may do with them. A
// reviewer holding Bash can rewrite the code it is reviewing with `sed -i`, and an architect holding
// Write can "fix" the implementation instead of the plan. Each agent here owns specific files, and
// the pipeline depends on that: a reviewer that edits what it reviews has stopped being a reviewer.
//
// Profiles live in `agentScopes` in `.claude/gates.json`. A profile that is missing refuses
// everything: a guard that fails open when its configuration is lost is not a guard.
//
// This is string matching. It stops an agent drifting out of its role, not an attacker.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir =
  process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  process.chdir(projectDir);
} catch {
  process.exit(0);
}

const { loadGates, matchesAny } = await import('./../../scripts/changed-files.mjs');
const { simpleCommand, startsWithCommand } = await import('./../../scripts/commands.mjs');

const name = process.argv[2] ?? '';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `[${name || 'unnamed agent'}] ${reason}`,
      },
    }),
  );
  process.exit(0);
};

const gates = loadGates();
const profile = gates.agentScopes?.[name];
if (!name || !profile || name.startsWith('$')) {
  deny(
    `no scope profile \`${name}\` in \`agentScopes\` in \`.claude/gates.json\`, so this agent is ` +
      'refused every tool call its frontmatter hooks. Add the profile, or remove the hook from the ' +
      'agent if it genuinely should be unrestricted.',
  );
}

const tool = payload.tool_name ?? '';
const input = payload.tool_input ?? {};

if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const target = String(input.file_path ?? input.notebook_path ?? '');
  const abs = isAbsolute(target) ? target : resolve(process.cwd(), target);
  // Resolve symlinks on both sides. `chdir` lands on the real path, while the tool reports the path
  // it was given, so a project reached through a symlink (macOS `/tmp`, a linked workspace) looked
  // entirely "outside the project" and every write was refused.
  const real = (p) => {
    let head = p;
    const tail = [];
    while (!existsSync(head) && dirname(head) !== head) {
      tail.unshift(head.slice(dirname(head).length + 1));
      head = dirname(head);
    }
    try {
      return join(realpathSync(head), ...tail);
    } catch {
      return p;
    }
  };
  const rel = relative(real(process.cwd()), real(abs));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    deny(`\`${target}\` is outside the project. This agent writes only inside it.`);
  }
  const expand = (list) => (list ?? []).flatMap((g) => (g === '@infra' ? gates.infra.paths : [g]));
  const globs = expand(profile.write);
  // `create` globs admit a new file and nothing else: an architect may propose a decision record,
  // never rewrite an accepted one.
  const createOnly = expand(profile.create);
  if (!matchesAny(rel, globs) && matchesAny(rel, createOnly)) {
    if (tool === 'Write' && !existsSync(abs)) process.exit(0);
    deny(`may create \`${rel}\` but not change it once it exists. Records like this are superseded, not edited.`);
  }
  if (!matchesAny(rel, globs)) {
    deny(
      `may not write \`${rel}\`. Its lane is: ${globs.length ? globs.map((g) => `\`${g}\``).join(', ') : 'nothing, it is read-only'}.\n\n` +
        'If the change belongs in another file, say what it is and return it to the caller. The ' +
        'agent that owns that file makes it.',
    );
  }
  process.exit(0);
}

if (tool === 'Bash') {
  const command = String(input.command ?? '');
  const parts = simpleCommand(command, { pipes: Boolean(profile.pipes) });
  if (!parts) {
    deny(
      'chained, redirected or substituted commands are refused for this agent. Run one command, ' +
        'optionally prefixed by `cd <dir> &&`' +
        (profile.pipes ? ', piped only into other allowed commands.' : '.') +
        ' The full output already comes back to you, so there is no need to pipe it into `head`.',
    );
  }
  const allowed = profile.bash ?? [];
  const refused = parts.filter((p) => !allowed.some((prefix) => startsWithCommand(p, prefix)));
  if (refused.length) {
    deny(
      `may not run \`${refused[0]}\`. Allowed: ${allowed.map((a) => `\`${a}\``).join(', ') || 'no shell at all'}.\n\n` +
        'If the task genuinely needs something else, stop and say what and why. Do not look for a ' +
        'different command that does the same thing.',
    );
  }
  process.exit(0);
}

process.exit(0);

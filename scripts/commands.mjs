/**
 * One reading of a shell command, shared by the hooks that judge commands.
 *
 * Both the apply guard and the agent scope hook need to answer "what is this command actually
 * going to run". Parsing it twice, slightly differently, is how two guards come to disagree about
 * the same string, which is the failure `changed-files.mjs` exists to prevent for file lists.
 *
 * This is a small quote-aware tokenizer, not a shell. It stops accidents, not intent: a determined
 * command can be written past any of it. Real containment is not having production credentials on
 * the machine that runs the agent.
 */

/**
 * Split a command into segments of words. Operators (`;`, `&&`, `||`, `|`, `&`, newline) start a
 * new segment only outside quotes, so `git commit -m "a; terraform apply"` stays one harmless
 * segment. Unquoted parentheses are dropped, so a subshell `(cd x && tofu apply)` is read through.
 * Each segment records which operator ended it and whether it held an unquoted redirection.
 */
export function parse(command) {
  const src = String(command ?? '');
  const out = [];
  let seg = { words: [], op: null, redirects: [], substitution: false };
  let word = '';
  let inWord = false;
  let quote = null;

  const endWord = () => {
    if (inWord) seg.words.push(word);
    word = '';
    inWord = false;
  };
  const endSeg = (op) => {
    endWord();
    seg.op = op;
    if (seg.words.length || seg.redirects.length) out.push(seg);
    seg = { words: [], op: null, redirects: [], substitution: false };
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const two = src.slice(i, i + 2);
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < src.length) word += src[++i];
      else {
        if (quote === '"' && (two === '$(' || ch === '`')) seg.substitution = true;
        word += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inWord = true;
      continue;
    }
    if (ch === '\\' && i + 1 < src.length) {
      word += src[++i];
      inWord = true;
      continue;
    }
    if (two === '&&' || two === '||') {
      endSeg(two);
      i++;
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '|' || ch === '&') {
      if (ch === '&' && /[<>]$/.test(word)) {
        word += ch;
        inWord = true;
        continue;
      }
      endSeg(ch);
      continue;
    }
    if (two === '$(' || ch === '`') seg.substitution = true;
    if (ch === '(' || ch === ')') {
      endWord();
      continue;
    }
    if (/\s/.test(ch)) {
      endWord();
      continue;
    }
    if (ch === '>' || ch === '<') {
      // Collect the whole redirection, `2>&1`, `>/dev/null`, `> out.txt`, as one item.
      const fd = /^\d$/.test(word) ? word : '';
      if (fd) {
        word = '';
        inWord = false;
      } else endWord();
      let r = fd + ch;
      while (src[i + 1] === '>' || src[i + 1] === '&') r += src[++i];
      while (/\s/.test(src[i + 1] ?? '')) i++;
      let target = '';
      while (i + 1 < src.length && !/[\s;|&()<>]/.test(src[i + 1])) target += src[++i];
      seg.redirects.push(r + target);
      continue;
    }
    word += ch;
    inWord = true;
  }
  endSeg(null);
  return out;
}

/** Words of each segment, for callers that only need those. */
export function segments(command) {
  return parse(command).map((s) => s.words);
}

const IAC_TOOLS = new Set(['terraform', 'tofu', 'terragrunt']);
const base = (w) => (w ?? '').split('/').pop();
const isAssignment = (w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w ?? '');

/**
 * Index of the command a segment actually runs, looking through wrappers: `VAR=value`, `env`,
 * `time`, `nice`, `nohup`, `command`, `exec`, `sudo`, `timeout <duration>`, `xargs`, and runners
 * that take `--` (`mise exec -- tofu`) or a profile (`aws-vault exec dev terraform`). Only the
 * command position counts, so prose that merely mentions a tool is not mistaken for running it.
 */
function commandIndex(w) {
  let i = 0;
  for (let guard = 0; guard < 20 && i < w.length; guard++) {
    const x = base(w[i]);
    if (isAssignment(w[i])) i++;
    else if (['env', 'time', 'nice', 'nohup', 'command', 'exec', 'sudo', 'xargs'].includes(x)) {
      i++;
      while (i < w.length && (w[i].startsWith('-') || isAssignment(w[i]))) i++;
    } else if (x === 'timeout') {
      i++;
      while (i < w.length && w[i].startsWith('-')) i++;
      i++; // the duration
    } else if (x === 'aws-vault' && w[i + 1] === 'exec') {
      i += 2;
      while (i < w.length && w[i].startsWith('-')) i++;
      i++; // the profile
      if (w[i] === '--') i++;
    } else if (w.slice(i).includes('--') && !IAC_TOOLS.has(x)) {
      i = i + w.slice(i).indexOf('--') + 1;
    } else break;
  }
  return i < w.length ? i : -1;
}

// Subcommands that change real infrastructure or the state that describes it. Every one of them is
// run by the human, never by an agent, at every stage. `plan -destroy` is not here: it only prints.
const MUTATING = new Set([
  'apply', 'destroy', 'import', 'refresh', 'taint', 'untaint', 'force-unlock', 'apply-all', 'destroy-all',
]);
const MUTATING_STATE = new Set(['rm', 'mv', 'push', 'replace-provider']);
const MUTATING_INIT_FLAGS = ['-migrate-state', '-force-copy'];

function mutationIn(w) {
  const at = commandIndex(w);
  if (at === -1) return null;
  const cmd = base(w[at]);

  // `sh -c "terraform apply"`: judge the inner command.
  if (['sh', 'bash', 'zsh'].includes(cmd)) {
    const c = w.indexOf('-c', at);
    return c !== -1 && w[c + 1] ? irreversibleInfra(w[c + 1]) : null;
  }
  if (!IAC_TOOLS.has(cmd)) return null;

  const rest = w.slice(at + 1).filter((x) => !/^-chdir=/.test(x));
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i];
    if (MUTATING.has(word)) return `${cmd} ${word}`;
    if (word === 'state' && MUTATING_STATE.has(rest[i + 1])) return `${cmd} state ${rest[i + 1]}`;
    if (word === 'workspace' && rest[i + 1] === 'delete') return `${cmd} workspace delete`;
    if (word === 'init' && rest.some((x) => MUTATING_INIT_FLAGS.some((f) => x.startsWith(f)))) {
      return `${cmd} init with a state migration flag`;
    }
  }
  return null;
}

/**
 * Returns a short description of the first infrastructure-mutating command found, or null.
 * Looks inside every segment and through wrappers and subshells, so `cd infra && terraform apply`,
 * `(cd x && tofu destroy)` and `env TF_LOG=debug terraform apply` are all caught, which a
 * prefix-matching permission rule would miss.
 */
export function irreversibleInfra(command) {
  for (const words of segments(command)) {
    const found = mutationIn(words);
    if (found) return found;
  }
  return null;
}

// Redirections that only discard or merge output. Anything else writes a file.
const HARMLESS_REDIRECT = /^(\d?>\/dev\/null|\d?>&\d|&>\/dev\/null)$/;

/**
 * Reduce a command to the simple commands it runs, for an allowlist to judge. Allowed around them:
 * one leading `cd <dir> &&`, `VAR=value` assignments, redirections to `/dev/null` or between
 * streams, and, when `pipes` is set, `|` between commands. Returns null for anything else chained,
 * redirected into a file or substituted, so the caller refuses it rather than judging a compound
 * command piece by piece.
 */
export function simpleCommand(command, { pipes = false } = {}) {
  let segs = parse(command);
  if (segs.length && segs[0].words[0] === 'cd' && segs[0].words.length === 2 && segs[0].op === '&&') {
    segs = segs.slice(1);
  }
  if (!segs.length) return null;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.substitution) return null;
    if (s.redirects.some((r) => !HARMLESS_REDIRECT.test(r))) return null;
    const last = i === segs.length - 1;
    if (last ? s.op !== null : !(pipes && s.op === '|')) return null;
    if (!s.words.length) return null;
  }
  return segs.map((s) => {
    const w = s.words.slice();
    while (w.length && isAssignment(w[0])) w.shift();
    if (['terraform', 'tofu'].includes(w[0]) && /^-chdir=/.test(w[1] ?? '')) w.splice(1, 1);
    return w.join(' ');
  });
}

/** Does one command match one allowed prefix, on a word boundary. */
export function startsWithCommand(cmd, prefix) {
  return cmd === prefix || cmd.startsWith(`${prefix} `) || (prefix.endsWith('/') && cmd.startsWith(prefix));
}

import { spawnSync } from 'node:child_process';

/** A test assertion failure and a runner that never completed are different repair inputs. */
export function runTest(command, { timeout = 10 * 60 * 1000, runner = spawnSync } = {}) {
  const r = runner(command, { shell: true, encoding: 'utf8', timeout });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const environmentError = r.error?.message ?? (r.signal ? `terminated by ${r.signal}` :
    [126, 127].includes(r.status) ? `runner exited ${r.status}` :
    r.status > 128 && r.status <= 192 ? `shell reported signal ${r.status - 128}` :
    /command not found|(?:^|\n).*:\s*[^\n]+:\s*not found(?:\n|$)/i.test(output) ? 'command not found' :
    r.status === null ? 'runner did not return an exit code' : null);
  return { code: r.status ?? 1, output, environmentError };
}

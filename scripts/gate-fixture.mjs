import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Mechanism inputs are test-owned; optional application configuration is not a fixture. */
export function configureGateFixture(root) {
  const path = join(root, '.claude/gates.json');
  const gates = JSON.parse(readFileSync(path, 'utf8'));
  const profiles = {
    'fixture-writer': { write: ['@infra'], bash: ['terraform plan'], pipes: false },
    'fixture-reviewer': { write: ['docs/specs/*/review.md'], bash: ['terraform fmt -check'], pipes: false },
    'fixture-reader': { write: [], bash: ['git diff', 'head', 'rg'], pipes: true },
    'fixture-creator': { write: [], create: ['docs/decisions/0*-*.md'], bash: [], pipes: false },
    'fixture-scanner': { write: [], bash: ['semgrep scan'], pipes: true },
    'fixture-browser': { write: [], bash: ['npx playwright screenshot'], pipes: true },
  };
  Object.assign(gates, {
    stage: 'building',
    sourcePaths: ['src/**'],
    infra: { paths: ['infra/**', '**/*.tf'], foundations: ['**/backend.tf'], lightBootstrapMaxComponents: 5 },
    docs: { filesWithoutSpec: 3, logForNewFiles: true },
    stopHook: { requireAdrForGuardrails: true },
    agentScopes: { ...gates.agentScopes, ...profiles },
  });
  writeFileSync(path, JSON.stringify(gates, null, 2));
  const manifestPath = join(root, '.claude/tracks.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.tracks.core.profiles.push(...Object.keys(profiles));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(join(root, '.claude/onboarding.json'), JSON.stringify({ status: 'not-started' }));
  rmSync(join(root, '.claude/lint-baseline.json'), { force: true });
}

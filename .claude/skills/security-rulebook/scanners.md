# Scanners

What runs where. Versions are deliberately not pinned in this file: resolve and pin them in the
workflow when activating it, per AGENTS.md principle 8. A scanner that is not installed is
reported under "Not checked", never silently skipped.

| Concern | Tool | Local command | In CI |
|---|---|---|---|
| Secrets in the tree and history | gitleaks | `gitleaks git --redact` (history) or `gitleaks dir --redact` (tree) | `ci.yml`, always |
| Known-vulnerable dependencies, any ecosystem | osv-scanner | `osv-scanner scan source -r .` | `security.yml` |
| Static analysis (SAST) | semgrep | `semgrep scan --config p/default --metrics=off --error` | `security.yml` |
| Infrastructure as code | checkov | `checkov -d infra` | `infra.yml` |
| Containers and images | trivy | `trivy fs .` / `trivy image <image>` | `security.yml` when there is a Dockerfile |

Ecosystem-native audits, useful locally because they understand the package manager exactly:

| Stack | Command |
|---|---|
| Node, TypeScript, Next.js | `npm audit --omit=dev` (or `pnpm audit --prod`) |
| Python | `pip-audit` |
| Go | `govulncheck ./...` |

Rules:

- Scanner output is evidence, not a verdict. A reported vulnerability in a code path the project
  never calls is still fixed by upgrading when that is cheap, and otherwise accepted with a reason;
  a clean scan does not mean the code is secure. The reviewer judges both ways.
- Never paste a real secret a scanner found into chat, an issue or a commit message. Say which
  file and line, rotate the secret, then remove it from history with the human.
- Suppressions (`.gitleaksignore`, `# nosemgrep`, osv config) carry a reason on the same line and
  are reviewed like code. A suppression without a reason is a finding.

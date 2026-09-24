---
description: Full security audit of the project - threat model freshness, scanners, a reviewer pass over every entry point - written to a dated report.
argument-hint: "[optional: an area to focus on]"
---

# Security audit

Focus: **$ARGUMENTS** (the whole project if empty).

Run this before `/harden`, before a first public release, after a spec that adds an entry point or
personal data, and at least every six months while the project is live. For a single change, the
`security-reviewer` in `/ship` is enough; this is the whole-project pass.

## Steps

1. **Threat model.** Read `docs/security/threat-model.md`. Compare its entry points with the
   code's actual routes, handlers, jobs and webhooks (grep the router, not the docs). List every
   entry point missing from the model and every "in place" control whose evidence you cannot find.
2. **Scanners.** Check which are installed and run them, per
   `.claude/skills/security-rulebook/scanners.md`. Show real output summaries. A scanner that is
   not installed is listed, with the command to install it, under Not checked.
3. **Reviewer.** Spawn `security-reviewer` in audit mode with the focus above and the paths to
   the threat model and the scanner output. Pass paths, not content.
4. **Plugin check.** Confirm the `security-guidance` plugin is enabled for this project
   (`enabledPlugins` in `.claude/settings.json`) and that `.claude/claude-security-guidance.md`
   holds this project's rules rather than the template's stub text.
5. **Report.** Write `docs/security/audit-YYYY-MM-DD.md` with frontmatter `type: security`,
   `status: stable`, `last_verified` today, containing: scope, ASVS level, the reviewer's findings
   by severity, scanner results, threat-model gaps, Not checked, and the rule gaps. Link it from
   `docs/INDEX.md` under Security.
6. **Follow-through.** For each HIGH: stop and tell the human now, it blocks `/harden`. For each
   MEDIUM: propose fixing it or an ADR accepting it with a revisit date. Update the threat model
   for every gap found in step 1, and propose the rule gaps as additions to
   `.claude/claude-security-guidance.md`; write none without a yes.
7. `docs/log.md` entry: 3 to 6 bullets, linking the report.

Do not fix code during the audit. An audit that edits as it goes cannot say what it found.

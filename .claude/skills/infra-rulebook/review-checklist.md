# Review checklist

Used by `infra-reviewer` in both modes. Every section is walked every time and every item gets
PASS, FAIL or WARN. A section skipped because it "obviously passes" is how regressions ship.

## Plan review (mode 1)

1. **Completeness.** Every section of plan-format.md present, headings verbatim. Every module in
   section 1 used in section 4, and every module in section 4 versioned in section 1.
2. **Versions.** Each version has a source and a date. None looks recalled (a version older than
   the date it was "resolved" on, a submodule path nobody verified).
3. **Environments.** No shared infrastructure between environments without an ADR. Structure is
   identical across environments, or the difference is stated.
4. **Dependencies.** The graph has no cycle and no missing link. Apply order in section 7 follows
   it.
5. **Rulebook.** Layout, naming, tagging, state and secrets follow the rulebook, or the deviation
   carries a tag.
6. **Decisions.** Each foundation choice has an ADR number. None is still `proposed`.
7. **Open items.** None of them is already answered by the spec or the rulebook.

## Code review (mode 2)

### 1. Formatting and validation
- `fmt -check` clean across the tree.
- `validate` clean on every root, or `terragrunt run --all validate`.
- The engineer's `tasks.md` records a clean `plan` for every component it wrote.

### 2. Secrets and identifiers
- No literal secret, key or password. No 12-digit account id outside a data source or variable.
- `.gitignore` excludes state, plans, `.terraform/` and `.terragrunt-cache/`.
- Sensitive outputs are marked `sensitive`.

### 3. Structure
- Layout matches layout.md and the layout ADR.
- Terragrunt: no `terraform { source }` in a leaf; dependencies in shared config with
  `mock_outputs`.
- Own modules have the four-file interface, typed and described variables, no hardcoded region,
  zone, account or network range.

### 4. Naming and tagging
- Names follow the convention in the rulebook.
- Required tags applied through provider default tags.

### 5. Versions
- Modules pinned exactly, providers constrained, lock file committed, CLI pinned.

### 6. Security posture
- Encryption at rest on every data store and bucket, and in transit where the service allows.
- No `0.0.0.0/0` ingress except on a public load balancer's HTTP/HTTPS listeners.
- No IAM wildcard actions on wildcard resources. New permissions listed and justified.
- Public exposure (public buckets, public IPs, public endpoints) is intentional and tagged.

### 7. Plan hygiene
- No unexpected destroy or replace. Every expected one is named in the plan's section 7.
- The change analysis's plan expectation matches what the plan shows.

### 8. Cost
- New chargeable resources listed, with a rough monthly figure at the planned size. A change that
  multiplies the bill is an ADR.

### 9. Documentation
- `docs/ops/environments.md` and `docs/architecture/overview.md` describe what the code now
  builds, or the gap is stated.

## Verdicts

Every finding is tagged `[BLOCKING]` (would break or corrupt an apply, leaks a secret, crosses an
environment boundary) or `[NON-BLOCKING]` (drift between plan and code, a portability bug in an own
module, a misleading description). Then one of:

- `READY - no findings.` Skip the fix pass.
- `READY - N non-blocking findings.` Still triggers a fix pass: non-blocking means it does not
  corrupt the apply, not that it can wait.
- `BLOCKED - N findings.`

Two cycles at most. After the second, whatever remains goes to the human.

## Rule gaps

A problem this checklist or the rulebook would have caught, if it had a rule for it. One line
each, naming the file and the rule to add. Not a finding against the code: a proposal the human
accepts or declines.

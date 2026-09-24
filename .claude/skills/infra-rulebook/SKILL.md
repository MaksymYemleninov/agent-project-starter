---
name: infra-rulebook
description: The rules every piece of infrastructure code in this project follows - layout, naming, tagging, versions, state, secrets, module choice - plus the plan format and the review checklist. Read before planning, writing or reviewing Terraform, OpenTofu or Terragrunt. The infra agents read it at the start of every spawn.
---

# Infrastructure rulebook

This is the project's standard, not a tutorial. The infra agents plan against it, write against
it and review against it, so a rule that is not here is a rule nobody enforces.

It ships generic. `/onboard` or `infra-bootstrap` adapts it once the IaC decisions exist: the
naming format, the tag set and the layout become this project's, recorded in ADRs and linked
below. Where this file and an accepted ADR disagree, the ADR wins and this file is out of date:
fix it in the same change.

Reference files, read on demand:

| File | Read when |
|---|---|
| [layout.md](layout.md) | creating the tree, or orienting in an existing one |
| [plan-format.md](plan-format.md) | writing or reviewing an infrastructure plan |
| [review-checklist.md](review-checklist.md) | reviewing a plan or code |
| [aws-example.md](aws-example.md) | the project is on AWS; a worked baseline, not a mandate |

## 1. Tooling

- Terraform or OpenTofu, optionally with Terragrunt on top. The choice is an ADR. Do not mix
  Terraform and OpenTofu in one tree: state written by one is not guaranteed readable by the other
  across versions.
- CLI versions are pinned in the repository (`.mise.toml`, `.tool-versions` or
  `.terraform-version`). An unpinned CLI makes last month's plan unreproducible.
- `terraform fmt` / `tofu fmt` and `terragrunt hcl fmt` output is the only accepted formatting.

## 2. Versions are resolved, never recalled

A version from memory is a version from the training data, which is to say out of date. Every
module, provider, chart and CLI version is looked up at the moment it is chosen:

- registry modules and providers: the registry API or the registry page,
- GitHub-hosted modules and CLIs: `gh api repos/<owner>/<repo>/releases/latest` or the tags,
- Helm charts: `helm show chart <repo>/<chart>`.

Record where each version came from and when, in the plan's version table. Modules are pinned
exactly. Providers use a pessimistic constraint (`~> 5.40`) and the committed lock file
(`.terraform.lock.hcl`) holds the exact build. A submodule path (`//modules/x`) is verified to
exist at that version before it is referenced.

## 3. Module choice, in priority order

1. A well-maintained public module from the registry, pinned. It has already met the edge cases.
2. This project's own module under `infra/modules/`, when no public one fits or the public one is
   the wrong shape. Its interface is `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`; every
   variable has a type and a description.
3. Raw resources in a root module, for glue that is not worth a module.

Going down the list is a `[PROPOSED]` item with a reason.

## 4. State

- Remote state, encrypted, with locking, from the first apply. Local state is for throwaway
  experiments only and never committed. `*.tfstate` is in `.gitignore` and in `secretPaths`: state
  holds secrets in plain text.
- One state per environment per component at least. A state that spans environments turns a
  staging change into a production blast radius.
- The state backend itself is created once, by hand or by a separate bootstrap root, and recorded
  in `docs/ops/environments.md`. It is a foundation: changing it is an ADR.

## 5. Environments

- Environments never share infrastructure unless an ADR says so. `dev` and `prod` sharing a VPC or
  a database "to save money" is the decision that later costs the most.
- Separate by directory (one root per environment), not by workspace, unless an ADR says
  otherwise. A directory can be read, reviewed and permissioned; a workspace is a hidden flag.
- What differs between environments is only data: sizes, counts, CIDRs, names. Structure is the
  same, or the difference is written down.

## 6. Naming and tagging

Replace this section with the project's convention once it is decided. Until then:

- Names: `<project>-<env>-<component>[-<detail>]`, lowercase, hyphenated. Some resources forbid
  hyphens or cap length; follow the resource's rule and note the exception.
- Every taggable resource carries at least `project`, `environment`, `managed-by` (`terraform` or
  `opentofu`), set once through provider default tags, not per resource.

## 7. Secrets and identifiers

- No secret in code, in `.tfvars`, in outputs or in plan text committed anywhere. Secrets live in
  the secret manager named in `docs/ops/environments.md` and are referenced, not copied.
- No hardcoded account ids, project ids or subscription ids: use data sources or variables.
- Outputs that carry anything sensitive are marked `sensitive = true`.

## 8. Who does what

- Agents write code, run `fmt`, `validate`, `plan`, and read-only state commands. Nothing else.
- **The human runs `apply`, `destroy`, `import` and every state-moving command.** The `pre-bash`
  hook refuses them for agents at every stage. Hand them over with the plan summary.
- A plan that shows any destroy or replace is called out in plain words before it is handed over,
  with the resource addresses. "Some resources will be replaced" is not a summary.

## 9. Errors: code or environment

Every failed command is one of two kinds. Classify before reacting.

| Kind | Looks like | Do |
|---|---|---|
| Code | undeclared reference, wrong input type, missing output, schema mismatch, a rule in this file broken | Fix it, re-run, loop until clean |
| Environment | `command not found`, expired or missing credentials, `AccessDenied`, network timeout, backend unreachable, provider download failure, CLI version mismatch | **Stop.** Paste the error verbatim, say which dimension is wrong, return. Do not change code to route around it, do not reconfigure tooling, do not retry in a loop |

If the error names your file, line, resource or input, it is yours. If it names a binary, a
credential, the network or the cloud API, it is not. When unsure, escalate: a wrong "fix" to an
environment error costs hours, a question costs a minute.

A third case looks like code and is neither: a data source that looks up something an upstream
component creates, planned before that component is applied. It clears once the upstream is
applied. Record it with the upstream it waits on and continue with components that do not depend
on it.

## 10. Tags that mark intent

- `[OVERRIDE: <requirement>]` - deviates from a default in this rulebook because a stated
  requirement forces it. Cite the requirement.
- `[PROPOSED: <reason>]` - added on the planner's own judgment, neither required nor a default.

Applied at the moment the choice is made, not added during a fix pass. A tag that first appears
after review means the deviation was not noticed when it was designed. Reviewers do not report
tagged items as mistakes; they list them, so every `[PROPOSED]` item gets a human's look.

## Project decisions

Link the accepted ADRs that shape this rulebook here: tool, layout, state backend, environment
and account model, naming.

- none yet

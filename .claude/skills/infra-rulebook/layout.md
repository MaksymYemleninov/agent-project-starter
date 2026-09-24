# Layout

Two supported shapes. The choice is an ADR; both keep everything under `infra/` so that
`infra.paths` in `.claude/gates.json` matches without tuning.

## Plain Terraform or OpenTofu

```
infra/
  bootstrap/                  # state backend, created once, applied by hand
  modules/
    <component>/              # this project's own modules
      main.tf
      variables.tf
      outputs.tf
      versions.tf
  envs/
    <env>/                    # one root module per environment (or per env and component)
      backend.tf              # foundation: changing it is an ADR
      providers.tf
      versions.tf
      main.tf                 # calls modules, nothing clever
      variables.tf
      <env>.auto.tfvars       # data only, never secrets
      .terraform.lock.hcl     # committed
```

A root module is any directory with a `backend` or `provider` block. A large environment splits
into one root per component (`envs/prod/network/`, `envs/prod/data/`) so that one state does not
hold everything, and components read each other through remote state or data sources.

## Terragrunt

```
infra/
  root.hcl                    # foundation: backend generation, provider generation, common tags
  _catalog/
    <domain>/<component>.hcl  # shared config: module source pinned once, dependencies, defaults
  modules/
    <component>/              # this project's own modules
  live/
    <env>/
      env.hcl                 # foundation: environment-wide values
      <region>/
        region.hcl            # foundation
        <domain>/<component>/
          terragrunt.hcl      # includes root + catalog entry, holds only env-specific inputs
```

Rules for this shape:

- The module `source` is pinned once, in the catalog entry. A leaf never declares its own
  `terraform { source }`, or two environments silently run two versions.
- `dependency` blocks live in the catalog entry, with `mock_outputs` so that `plan` works before
  the upstream is applied. A leaf declares a dependency itself only when the path differs per
  environment.
- Supporting resources (security groups, log buckets, policies) live next to the component they
  serve, not in a top-level pile.

## Orienting in an existing tree

Do not assume either shape; detect it.

1. Terragrunt if any `terragrunt.hcl` exists outside `.terragrunt-cache/`. Plain Terraform if a
   directory holds `.tf` files with a `backend` or `provider` block. Both can coexist.
2. List units: every `terragrunt.hcl`, or every root-module directory. A directory reachable only
   through a `module` block is a child module, not a unit.
3. Find shared configuration by name, not by path: `root.hcl`, `env.hcl`, `account.hcl`,
   `region.hcl`, `common.hcl`, `backend.tf`, `providers.tf`, `versions.tf`, `*.auto.tfvars`, and
   the tool-version pins. Read all of them; they are few and carry most of the context.
4. Read one unit per distinct component, not one per environment. Read a second only when the
   listing shows the environments differ in structure.
5. Write down what the code does not answer as "not determined". "Not determined" and "none" are
   different statements and must never be collapsed.

If the tree does not match `infra/` or the globs in `infra.paths`, fix `.claude/gates.json` in the
same change, or the gates and the engineer's write scope do not see it.

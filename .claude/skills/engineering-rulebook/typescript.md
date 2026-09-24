# Pack: TypeScript and Node

For any TypeScript service, library or CLI. Next.js applications read [nextjs.md](nextjs.md) as
well. Versions: resolve the current Node LTS and each tool's latest release when configuring, and
pin them (`.nvmrc` or `engines`, exact dev dependency versions, the lock file committed).

## Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Runtime | current Node LTS | pinned in `.nvmrc` and `engines` |
| Package manager | one, recorded in the stack ADR (`npm` or `pnpm`) | lock file committed; `packageManager` field set |
| Type checking | `tsc --noEmit` in CI | see strictness below |
| Lint | ESLint with `typescript-eslint` type-aware rules | warnings are errors in CI |
| Format | Prettier (or Biome if the ADR chooses it for lint and format together) | never both a formatter and a lint rule for style |
| Boundaries | `dependency-cruiser` | rules generated from `docs/architecture/overview.md` |
| Tests | Vitest (or the framework's runner) | Testcontainers for database integration tests |
| Validation | Zod (or Valibot), one of them | schemas are the source of the input types |

## Strictness

`tsconfig.json` at minimum: `"strict": true`, `"noUncheckedIndexedAccess": true`,
`"exactOptionalPropertyTypes": true`, `"noImplicitOverride": true`,
`"noFallthroughCasesInSwitch": true`, `"verbatimModuleSyntax": true`, `"isolatedModules": true`.
Loosening one is an `[OVERRIDE]` with a reason in the file.

ESLint rules worth enforcing, each because agents get them wrong: `@typescript-eslint/no-explicit-any`,
`no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`,
`consistent-type-imports`, `no-unnecessary-condition`, and `complexity` / `max-lines-per-function`
with loose limits.

## Layout

```
src/
  config.ts              # parses process.env with a schema, exports typed config; the only reader of env
  <feature>/
    index.ts             # the feature's public surface; other features import only this
    <feature>.routes.ts  # edge: parse with schema, authorize, call service, map result to response
    <feature>.service.ts # domain: rules, no I/O except through injected ports
    <feature>.repo.ts    # adapter: database access
    <feature>.schema.ts  # zod schemas and the types inferred from them
    <feature>.test.ts
  shared/                # small, stable utilities; not a dumping ground
```

## Rules

- **No `any`**, including `as any` and untyped JSON. External data enters as `unknown` and leaves a
  schema as a typed value. *Lint.*
- **Types come from schemas** (`z.infer`), not written twice. *Reviewed.*
- **Expected errors are typed.** Either a discriminated union result (`{ ok: true, value } | { ok:
  false, error }`) or a small set of error classes mapped to responses in one place at the edge.
  Pick one per project in the stack ADR. Never `throw` a string. *Reviewed.*
- **Every promise is awaited or explicitly handled.** *Lint (`no-floating-promises`).*
- **Exhaustive switches** over unions, with a `never` check in the default. *Lint.*
- **No default exports** in application code; named exports keep imports greppable. *Lint.*
- **Dates and money** are not raw numbers: a date library or `Temporal` when available, integer
  minor units or a decimal library for money. *Reviewed.*
- **Imports across features** go through `index.ts` only. *dependency-cruiser.*
- **Environment** is read only in `config.ts`. *Lint (`no-restricted-properties` on `process.env`).*

## Boundary rules

What phase 6 writes into `.dependency-cruiser.cjs`, mapped to the layout above: the edge is
`*.routes.ts`, the domain is `*.service.ts` and `*.schema.ts`, the adapter is `*.repo.ts`, and
`index.ts` is the only place that wires an adapter into a service.

| Rule | Forbids | Sees |
|---|---|---|
| `no-circular` | any dependency cycle under `src/` | paths |
| `no-feature-internals` | a file in `src/<a>/` importing anything in `src/<b>/` except `src/<b>/index.ts` | paths |
| `no-upward-feature` | a feature importing one placed above it, when the overview orders features | paths |
| `no-adapter-in-edge` | `*.routes.ts` importing `*.repo.ts` | paths |
| `no-adapter-in-domain` | `*.service.ts` or `*.schema.ts` importing `*.repo.ts` | paths |

When the overview orders features, keep the order in one list (`boundaries.config.cjs`,
`groups`, lowest first) and generate `no-upward-feature` from it. The script that generates the
rules never names a feature itself; the list is the project's configuration.

A path rule cannot see an adapter that reaches the edge through a barrel: `index.ts` exports a
repo, and a routes file imports it by name. Close that with ESLint `no-restricted-imports` in an
override for `**/*.routes.ts`, using a pattern with `importNamePattern` on the adapter suffix
(`Repo$`). Resolve the option shape against the ESLint version you pin. *Lint.*

`npm run check:boundaries` runs a small wrapper, not bare `depcruise`: it exits 2 when a folder
named in the configuration or in `groups` does not exist, or when the cruise found no modules, and
only then runs `depcruise src --config .dependency-cruiser.cjs`. Keep `tsConfig` in the
dependency-cruiser options so path aliases resolve. Prove every rule red once, as onboarding asks.

What the check does not see, so review still does:

- runtime wiring: a service handed the wrong adapter by a factory passes;
- imports that do not resolve: no edge, no violation;
- namespace (`import * as`) and dynamic (`await import(path)`) imports;
- I/O written straight into a service: the rules are shaped by paths, not content;
- test files, which are excluded on purpose because they wire across layers.

The rule set and the "does not see" list are adapted from CleanSlice's boundary check
(<https://github.com/CleanSlice/mcp/blob/main/docs/02-standards/boundary-check.md>), where a
path-only check missed six controllers importing an adapter through a barrel.

## Commands to put in AGENTS.md

`npm run typecheck` (`tsc --noEmit`), `npm run lint`, `npm run format:check`, `npm run
check:boundaries` (the wrapper above, then `depcruise src`), `npm test`.

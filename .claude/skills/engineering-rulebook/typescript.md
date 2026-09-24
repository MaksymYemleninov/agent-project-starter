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

## Commands to put in AGENTS.md

`npm run typecheck` (`tsc --noEmit`), `npm run lint`, `npm run format:check`, `npm run
check:boundaries` (`depcruise src`), `npm test`.

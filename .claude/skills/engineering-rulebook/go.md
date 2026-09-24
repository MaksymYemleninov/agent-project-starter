# Pack: Go

For services and CLIs. Resolve the current Go release when configuring and set it in `go.mod`
(`go` and `toolchain` lines); pin `golangci-lint` in CI.

## Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Format | `gofmt` (via `golangci-lint`'s formatters or directly) | not negotiable in Go |
| Lint | `golangci-lint` with an explicit, committed `.golangci.yml` | never rely on its defaults |
| Vet and vulnerabilities | `go vet ./...`, `govulncheck ./...` | both in CI |
| Boundaries | `internal/` packages plus `depguard` rules | the compiler enforces `internal/` for free |
| Tests | `go test -race ./...`; Testcontainers for databases | table-driven tests |
| Validation | explicit parsing into typed structs at the edge | a validation library if the ADR picks one |

## Layout

```
cmd/<binary>/main.go         # wiring only: config, dependencies, start
internal/
  config/                    # the only reader of os.Getenv; fails fast on invalid config
  <feature>/
    handler.go               # edge: decode, validate, authorize, call service, encode
    service.go               # domain: rules; depends on small interfaces it defines
    store.go                 # adapter: database
    <feature>_test.go
  platform/                  # shared adapters: db, http client, logging
```

No `pkg/` unless the project really publishes a library for others. No `utils` or `common`
package that everything imports.

## Rules

- **Accept interfaces, return structs.** Interfaces are defined by the consumer, next to where they
  are used, and are small. No interface with one implementation and no test using a fake. *Reviewed.*
- **Errors are wrapped with context** (`fmt.Errorf("load invoice %s: %w", id, err)`) and checked
  with `errors.Is` / `errors.As`. Expected errors are sentinel values or typed errors, mapped to
  responses once, in the handler. Never ignore an error (`_ =` needs a comment). *Lint (`errcheck`,
  `wrapcheck`, `errorlint`).*
- **`context.Context` is the first parameter** of anything that does I/O or can be cancelled, and
  is passed down, never stored in a struct. *Lint (`contextcheck`, `containedctx`).*
- **No goroutine without an owner.** Every goroutine has a way to stop (context, done channel) and
  someone who waits for it (`errgroup`). *Reviewed + `go test -race`.*
- **No `panic` for expected failures**; panics only for programmer errors at startup. *Reviewed.*
- **No global mutable state**; dependencies are passed in from `main`. *Lint (`gochecknoglobals`,
  with exceptions noted) + reviewed.*
- **SQL through parameters** (`database/sql`, `sqlc`, or the ADR's choice); never string
  formatting. *Lint (`gosec`) + security-reviewer.*
- **Structured logging with `log/slog`**, passed in, not the global logger. *Reviewed.*
- **Imports across features** go through each feature's exported API; `depguard` forbids the
  imports `docs/architecture/overview.md` rules out. *depguard.*

`golangci-lint` linters to enable beyond the defaults: `errcheck, errorlint, wrapcheck, gosec,
contextcheck, containedctx, bodyclose, noctx, revive, gocritic, gocyclo, depguard, exhaustive,
gochecknoglobals`, with `gocyclo` loose.

## Boundary rules

Section 2 of `SKILL.md`, in Go terms. Cycles between packages are a compile error already.
`internal/` keeps code outside the module from importing it. `depguard` carries the rest from the
overview: which feature packages may import which, and that no feature imports another
feature's adapter package when a feature is split into subpackages. Resolve the `depguard`
configuration shape against the golangci-lint version you pin.

A `depguard` rule whose file glob matches nothing is silent. Prove each rule red once, and fail the
check step when a package path named in the rules does not exist (`go list <path>` exits non-zero).

The limit to say out loud: when `handler.go`, `service.go` and `store.go` share one package, the
layers inside a feature are files, and no import checker sees them. That layer split is review,
unless the project splits features into subpackages.

## Commands to put in AGENTS.md

`gofmt -l .` (empty output means formatted), `golangci-lint run`, `go vet ./...`, `govulncheck
./...`, `go test -race ./...`.

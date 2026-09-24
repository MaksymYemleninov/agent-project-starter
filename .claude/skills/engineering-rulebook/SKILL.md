---
name: engineering-rulebook
description: How code in this project is written - structure, boundaries, errors, validation, configuration, logging, testing, dependencies - as stack-agnostic principles plus one pack per stack (TypeScript, Next.js, Python, Go, NestJS + Nuxt). Read before writing or reviewing application code, and at onboarding to pick and apply the pack. code-reviewer checks changes against it.
---

# Engineering rulebook

The standard for application code. Most of it is enforced by tools configured at onboarding
(strict type checking, a linter, a formatter, a boundary checker); what tools cannot check,
`code-reviewer` checks against this file. A rule that is neither enforced nor reviewed is a wish,
so each principle below says which one applies.

Stack packs, read the one this project uses:

| Pack | For |
|---|---|
| [typescript.md](typescript.md) | any TypeScript or Node service, library or CLI |
| [nextjs.md](nextjs.md) | Next.js applications; read together with typescript.md |
| [python.md](python.md) | Python services, workers, CLIs |
| [go.md](go.md) | Go services and CLIs |
| [nestjs-nuxt.md](nestjs-nuxt.md) | NestJS API + Nuxt app on the CleanSlice architecture; read together with typescript.md |

`/onboard` phase 5 picks the pack from the stack ADRs, writes its hard rules into path-scoped
files under `.claude/rules/`, and deletes the packs this project does not use. Phase 6 configures
the tooling each pack names. Tool versions are never taken from these files: resolve and pin them
when configuring (AGENTS.md principle 8).

## 1. Principles

**Simple first; patterns earn their place.** Start with plain functions and modules. Introduce an
abstraction (a repository, an interface, a factory, an event) when a second real use appears or a
test cannot be written without it, and say which in the review. An abstraction with one
implementation and no test seam is cost without benefit. *Reviewed.*

**Structure by feature, layer inside.** Group code by what it does for the user (`billing/`,
`accounts/`), not by technical kind (`controllers/`, `models/` for the whole app). Inside a
feature, keep three concerns apart: the edge (HTTP, CLI, queue: parse, authorize, respond), the
domain (rules, no I/O), and adapters (database, external APIs). *Boundary checker + reviewed.*

**Dependencies point inward.** The domain imports nothing from the edge or from adapters; adapters
implement what the domain needs. Features talk through each other's public entry point, never
their internals. The boundaries in `docs/architecture/overview.md` are written into the boundary
checker's configuration, so crossing one fails the build rather than a review. *Boundary checker.*

**Parse at the edge, trust types inside.** Every external input (request, env, file, message, API
response) is parsed into a typed value by a schema at the boundary, once. Inside, functions take
typed values, not raw strings or dictionaries. *Type checker + reviewed.*

**Errors are values with context, handled once.** Expected failures (not found, conflict, invalid
input) are part of the function's type or a documented error kind, mapped to a response at the
edge. Unexpected ones propagate with the cause attached and are logged once, where they are
handled. Never swallow an error, never log and rethrow the same error at every layer, never return
a bare `null` for "failed". *Linter + reviewed.*

**Configuration is parsed at startup and fails fast.** One module reads the environment, validates
it with a schema, and exposes a typed config object. The process refuses to start with a missing
or invalid value. Nothing else reads the environment. *Reviewed.*

**Logs are structured and safe.** Key-value or JSON logs with a request or correlation id; levels
used deliberately; no secrets, tokens or unnecessary personal data. *Reviewed, security-reviewer.*

**Side effects are explicit.** Time, randomness, I/O and global state come in through parameters or
a small context, so the domain is testable without mocks of the language runtime. *Reviewed.*

**Tests pin behaviour, at the cheapest level that proves it.** Domain rules get fast unit tests;
adapters get integration tests against the real thing (a containerised database, not a mock of the
driver); the edge gets a few end-to-end tests of the critical paths. Each EARS criterion maps to a
named test. A test that passes against a broken implementation is removed or fixed. *Test runner +
test-writer + reviewed.*

**Dependencies are decisions.** A new runtime dependency is an ADR-test question (ADR 0000). Prefer
the standard library and what is already installed. Pin via the lock file; remove what is unused.
*ADR gate + security scanners.*

**Names say what, comments say why.** No comment restating the code; a comment where the reason is
not visible (a workaround, a constraint, a surprising choice), with a link to the ADR or issue.
*Reviewed.*

**Small, reversible changes.** One concern per pull request. A refactor and a behaviour change do
not share a diff. *Reviewed, `/ship`.*

## 2. Mechanical floor, every stack

Configured in phase 6, run in `code.yml` once it is active, and required by `/harden`:

1. A formatter, run on save or pre-commit, with its output the only accepted formatting.
2. A linter with the pack's rule set, warnings treated as errors in CI.
3. The strictest practical type checking the stack offers.
4. A boundary checker encoding `docs/architecture/overview.md`, with at least three kinds of rule:
   no cycles anywhere, features importing each other only through their public entry point and
   only in the direction the overview allows, and layers inside a feature (the edge and the domain
   never import an adapter), unless the pack says why its stack cannot express one of them and
   hands it to review. Every path a rule names must exist: the check exits non-zero, not
   green, when its configuration names a folder that is not there, because a rule that matches
   nothing checks nothing. Each pack lists what its checker does *not* see; that part stays review.
5. The test command, failing when the code is wrong (`/harden` step 5 verifies that part).
6. Complexity limits in the linter (function length, cyclomatic complexity, parameters), set loose
   enough that hitting one means something.

Each goes into the Commands table in `AGENTS.md`. A rule that has a tool gets the tool, not a
sentence in a rule file.

## 3. What code-reviewer checks against this file

The things tools do not see: an abstraction without a second use or a test seam, I/O inside the
domain, validation repeated inside the boundary or missing at it, errors swallowed or logged at
every layer, configuration read outside the config module, a test that would pass against a broken
implementation, a refactor mixed into a behaviour change, and any pack rule marked *reviewed*.
Deviations carry `[OVERRIDE]` or `[PROPOSED]` like everywhere else.

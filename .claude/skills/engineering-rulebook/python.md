# Pack: Python

For services, workers and CLIs. Resolve the current supported Python release and each tool's
version when configuring, and pin them (`.python-version`, `requires-python`, the lock file).

## Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Project and dependencies | `uv` with `pyproject.toml` and `uv.lock` | one tool for venv, install, lock, run |
| Lint and format | Ruff (`ruff check`, `ruff format`) | replaces flake8, isort, black |
| Types | mypy `--strict` or pyright strict, one of them | run in CI on the whole package |
| Boundaries | `import-linter` | contracts generated from `docs/architecture/overview.md` |
| Tests | pytest, with `pytest-cov`; Testcontainers for databases | |
| Validation | Pydantic models at every boundary | settings through `pydantic-settings` |
| Web framework | per the stack ADR (FastAPI, Django, Flask) | the rules below hold for each |

## Layout

```
pyproject.toml
src/<package>/
  config.py              # pydantic-settings Settings, the only reader of os.environ
  <feature>/
    __init__.py          # the feature's public names; other features import only these
    api.py               # edge: parse with a Pydantic model, authorize, call service, map result
    service.py           # domain: rules, no I/O except through injected protocols
    repo.py              # adapter: database access
    models.py            # Pydantic schemas; ORM models kept separate from them
tests/
  <feature>/test_*.py
```

The `src/` layout keeps tests running against the installed package, not the working directory.

## Rules

- **Type hints everywhere public**, checked strict. `Any` needs a comment saying why. *Type checker.*
- **Pydantic at the edge, plain types inside.** Request bodies, env, messages and third-party API
  responses become models at the boundary; the domain takes models or dataclasses, not dicts.
  *Reviewed.*
- **Interfaces as `typing.Protocol`** where the domain needs an adapter; no abstract base classes
  for their own sake. *Reviewed.*
- **Expected errors are specific exception classes** from a small hierarchy per feature, mapped to
  responses in one handler at the edge. Never `except Exception: pass`; never a bare `except:`.
  *Ruff (`BLE`, `E722`) + reviewed.*
- **Async is all the way or not at all** within a request path. No blocking call (sync database
  driver, `requests`, `time.sleep`) inside an `async def`. *Reviewed.*
- **No mutable default arguments, no module-level state that changes.** *Ruff (`B006`).*
- **Unsafe deserialisation is forbidden on untrusted input**: `pickle`, `yaml.load` without
  `SafeLoader`, `eval`, `subprocess` with `shell=True`. *Ruff (`S` rules) + security-reviewer.*
- **Logging via the `logging` module or structlog**, structured, never `print` in service code.
  *Ruff (`T20`).*
- **Imports across features** go through the feature package's public names. *import-linter.*

Ruff rule selection to start from: `E, F, W, I, B, UP, S, BLE, T20, SIM, RET, PTH, C90`, with
`C90` complexity set loose.

## Boundary rules

The contracts phase 6 writes for import-linter, following section 2 of `SKILL.md`. A `layers`
contract is not enough on its own: a higher layer may import any lower one, so `api > service >
repo` still allows `api` and `service` to import `repo`. Use these instead:

| Contract | Type | Holds |
|---|---|---|
| no cycles | `acyclic_siblings` on the root package | no cycle between features, or between modules inside one |
| adapter stays behind the domain | `forbidden`, sources `<pkg>.*.api` and `<pkg>.*.service`, forbidden `<pkg>.*.repo` | the edge and the domain never import an adapter; the feature's `__init__.py` wires it |
| features meet at their package | one `forbidden` per feature, generated from the feature list: other features may not import `<pkg>.<feature>.*` submodules | cross-feature imports go through `__init__.py` names |
| feature order | `layers` over the feature packages, when the overview orders them | lower features do not import higher ones |

The generator reads the feature list and never names a feature itself. Resolve the contract
options against the import-linter version you pin. `acyclic_siblings` needs import-linter 2.6 or
later, and wildcards in `forbidden` contracts need 2.1 or later. Resolve and pin the current
release when you configure; do not copy a version from here.

### Starter configuration

A starting point for `pyproject.toml`, with `myapp` standing for the package under `src/` and the
feature names for the ones in the overview. The option names are from import-linter's documentation
for these contract types.

```toml
[tool.importlinter]
root_package = "myapp"
include_external_packages = true   # required for any contract that names an external package

[[tool.importlinter.contracts]]
name = "No cycles between features or inside one"
type = "acyclic_siblings"
ancestors = ["myapp", "myapp.*"]

[[tool.importlinter.contracts]]
name = "The edge and the domain never import an adapter"
type = "forbidden"
source_modules = ["myapp.*.api", "myapp.*.service"]
forbidden_modules = ["myapp.*.repo"]

[[tool.importlinter.contracts]]
name = "Only the edge imports the web framework"
type = "forbidden"
source_modules = ["myapp.*.service", "myapp.*.repo", "myapp.*.models"]
forbidden_modules = ["fastapi"]

[[tool.importlinter.contracts]]
name = "Features meet at their package (generated, one per feature)"
type = "forbidden"
source_modules = ["myapp.orders", "myapp.accounts"]   # every feature except billing
forbidden_modules = ["myapp.billing.*"]

[[tool.importlinter.contracts]]
name = "Feature order, when the overview orders the features"
type = "layers"
layers = ["myapp.orders", "myapp.billing"]   # higher first
```

A `forbidden` contract that names an external package needs `include_external_packages = true`
at the top level, and lists the package's root only: `fastapi`, not `fastapi.routing`. Without
the setting the contract cannot see external imports. Swap `fastapi` for the framework in the
stack ADR.

Do not edit this block into the project's file blindly: run `lint-imports` and prove each contract
red once, as above.

A `layers` contract already fails when a listed layer is missing. For the other contracts, the
step that runs `lint-imports` first asserts that every module a contract names imports, and fails
if one does not. Prove each contract red once.

It does not see what the import graph cannot: an adapter passed in at runtime, imports inside
functions (`importlib`, local `import` under a condition), or I/O written straight into
`service.py`. Those stay review.

Pack changes: 2026-09-24, boundary rules added; 2026-10-15, starter configuration and the
external-package setting added. A project onboarded earlier can compare its import-linter
contracts with this section.

## macOS: an editable install that does not import

Symptom: `uv sync` succeeds, the package is installed in editable mode, and `import myapp` still
fails. CPython skips `.pth` files that are hidden ([gh-113659](https://github.com/python/cpython/issues/113659)),
and editable installs rely on a `.pth` file in `.venv`. On macOS a file can carry the `hidden`
flag; the onboarding that found this saw it on files in a uv-created `.venv`. The cause of the
flag was not established, and the release that first shipped the skip was not confirmed.

Check: `ls -lO .venv/lib/python*/site-packages/*.pth` lists `hidden` among the flags.

If it does: `chflags nohidden` on those files is the likely fix (not verified by the template).
The alternative is an environment directory without a leading dot, set with
`UV_PROJECT_ENVIRONMENT`. Record which one the project uses in the stack ADR.

## Commands to put in AGENTS.md

`uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy src` (or `pyright`), `uv run
lint-imports`, `uv run pytest`.

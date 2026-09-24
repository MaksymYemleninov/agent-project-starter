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

## Commands to put in AGENTS.md

`uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy src` (or `pyright`), `uv run
lint-imports`, `uv run pytest`.

---
type: spec
id: "0005"
status: done
date: 2026-10-15
owner: maintainers
adrs: ["0009", "0013"]
ui: false
design: null
---
# 0005 - A Python pack that works on first use, and room left in the constitution

Companion documents: [plan](plan.md) - how it gets built, [tasks](tasks.md) - ordered work.

## Problem

A first onboarding with the Python pack produced a working toolchain (Ruff, mypy, import-linter),
and three things the pack does not prepare the reader for:

1. The pack names import-linter contracts in a table but gives no starter configuration. A
   `forbidden` contract that names an external package (`fastapi` outside the web layer) only works
   when the top-level `include_external_packages = true` is set, which the pack does not say.
   Its `acyclic_siblings` row names a contract type without saying which import-linter release
   introduced it, although the pack tells the project to pin a version.
2. On macOS, an editable install can fail to import although it installed: CPython skips `.pth`
   files that are hidden (gh-113659), and the onboarding found them hidden inside a uv-created
   `.venv`. The symptom looks like a broken project, not a platform flag.
3. The base `AGENTS.md` is 162 lines of a 200-line limit, and the linter warns from 170. After
   `/onboard` fills the project, code-map, commands and four stack principles, the onboarded
   project sat at 180, in the warning band, before any project rule was added.

## Goal

The Python pack carries a verified starter import-linter configuration and the one macOS trap it
met; the constitution leaves enough room that an onboarded project stays under the warning line.

## Non-goals

- Moving the working-agreement patterns out of `AGENTS.md`: [ADR 0009](../../decisions/0009-working-patterns-in-the-constitution.md)
  put them there. Doing so is a decision of its own, with its own ADR.
- Changing the 200-line limit or the 170-line warning, or any principle's wording or number.
- Rules for Django, Flask or other frameworks, or other packs.
- Fixing uv or Python. The pack documents the trap; it does not work around it in code.

## Users and triggers

An agent running `/onboard` phase 6 with the Python pack, a developer on macOS creating a `.venv`,
and anyone adding a principle to an onboarded `AGENTS.md`.

## Acceptance criteria

Python pack (`.claude/skills/engineering-rulebook/python.md`):

1. The pack shall contain a starter `[tool.importlinter]` block in `pyproject.toml` form, with
   `root_package`, `include_external_packages = true` and one contract for each row of its
   boundary table, using only option names that import-linter's documentation lists.
2. The pack shall state that a `forbidden` contract naming an external package needs
   `include_external_packages = true` and lists the package's root only (`fastapi`, not
   `fastapi.routing`), and shall show one contract that forbids `fastapi` outside the edge modules.
3. The pack shall state that `acyclic_siblings` needs import-linter 2.6 or later and wildcards in
   `forbidden` contracts need 2.1 or later, and shall tell the project to pin the version it
   resolves; it shall name no "latest" version.
4. The pack shall have a short note on hidden `.pth` files on macOS giving the symptom (an
   installed editable package that does not import), the cause, how to check (`ls -lO` shows
   `hidden`), and what to do, marking any step it has not verified as unverified.
5. When the starter block is parsed as TOML, a regression test shall fail if a contract uses a
   type other than `forbidden`, `layers`, `independence`, `protected` or `acyclic_siblings`, or
   if a contract names an external package while `include_external_packages` is not true.

Constitution (`AGENTS.md`):

6. The template's `AGENTS.md` shall be at most 145 lines.
7. The headings 1 to 8 and principles 2.1 to 2.8 shall keep their numbers and the four
   `<!-- onboard:... -->` blocks shall remain, and a regression test shall check this, because
   hooks cite `AGENTS.md` section 2.3 and 2.6 by number.
8. No rule shall be removed: each principle, working-agreement bullet and escalation condition is
   kept or merged into another line that says the same thing. Only table rows and prose tighten.
9. When `/onboard` phase 5 fills the `onboard:principles` block, it shall write the stack
   principles in at most six lines in total and put the detail in `.claude/rules/`.

## Security

No new entry point, data or role. Criterion 2 lets a project forbid a web framework's import in
the domain, which strengthens the boundary rules the pack already imposes. Criterion 4 adds
macOS guidance only, with no command that changes system settings; the `chflags` suggestion
touches files inside the project's own `.venv`. Criteria 6 to 8 reduce prose, not rules: the
section 2.5 and 2.6 principles (security, irreversible actions) stay verbatim.

## Out of band

none

## Open questions

- [x] Is 145 lines the right target, and may the cut come only from merging rows in the tables
  and tightening prose, leaving section 6 as it is? Decided by the maintainer: yes.
- [x] May the pack state the `chflags nohidden` step marked as unverified? Decided by the
  maintainer: yes, with the non-hidden environment directory as the alternative.

## Sources

Looked up on 2026-10-15, not recalled: import-linter's
[contract types](https://import-linter.readthedocs.io/en/latest/contract_types/),
[forbidden](https://import-linter.readthedocs.io/en/latest/contract_types/forbidden/) and
[acyclic_siblings](https://import-linter.readthedocs.io/en/latest/contract_types/acyclic_siblings/)
pages (type names, `ancestors`, `include_external_packages`, root-level external packages only),
its [release notes](https://import-linter.readthedocs.io/en/latest/release_notes/) (`acyclic_siblings`
in 2.6 on 2025-11-10; wildcards in forbidden and independence contracts in 2.1), its
[PyPI page](https://pypi.org/project/import-linter/) (2.15 on 2026-09-04, Python 3.10 or later) and
CPython [gh-113659](https://github.com/python/cpython/issues/113659) (hidden `.pth` files are
skipped; the release that first shipped it was not confirmed). That uv or macOS sets the hidden
flag on files in `.venv` is the onboarding's observation, not confirmed from a source here.

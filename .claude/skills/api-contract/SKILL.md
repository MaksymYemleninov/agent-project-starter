---
name: api-contract
description: Conventions for designing and changing this project's API. Use when adding or modifying an endpoint, event or schema. PLACEHOLDER until /onboard fills it from the chosen API style.
---

# API contract

> **Placeholder.** `/onboard` fills this from the API decisions it records, or deletes this skill
> if the project exposes no API.

## Style

REST, GraphQL, RPC or events. Where the schema lives and whether it is generated from code or
code is generated from it. Pick one direction and write it down; drift between the two is the
most common source of contract bugs.

## Naming and shape

Resource naming, pluralization, casing, pagination, filtering, sorting. Decide once, apply
everywhere. Inconsistency here is expensive because every client works around it individually.

## Errors

One error shape for the entire API, with a machine-readable code, a human-readable message, and
enough detail to act on. Document the status codes actually in use and what each means here.

## Versioning and compatibility

What counts as a breaking change, how versions are exposed, how long old ones are supported.

Additive changes are safe. Removing a field, narrowing a type, adding a required input, changing
a status code or tightening validation are all breaking, regardless of how unused they look.

## Changing an endpoint

1. Check whether the change is breaking by the definition above.
2. Breaking changes need an ADR before implementation.
3. Update the schema and the generated artifacts in the same change.
4. Contract tests before implementation, so the test fails for the right reason first.
5. Record it in the spec's `tasks.md`.

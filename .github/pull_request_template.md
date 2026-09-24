## What changed

<!-- One paragraph. What a reviewer sees in the diff. -->

## Why

<!-- The reason, not a restatement of the diff. Link the spec or ADR that holds the detail. -->

- Implements: <!-- docs/specs/NNNN-slug/spec.md, or "none, single-file change" -->
- Decisions: <!-- docs/decisions/NNNN-title.md, or "none" -->

## How it was verified

<!-- Actual commands run and their outcome. "Should work" is not verification. -->

- [ ] `npm run lint:docs`
- [ ] `npm run check:adr`
- [ ] tests
- [ ] tried by hand: <!-- what exactly -->

## Documentation

- [ ] New documents are listed in `docs/INDEX.md`
- [ ] `docs/log.md` has an entry for this work
- [ ] Anything that contradicts an existing document is called out below, not silently overwritten

## Escape reasons

Only if a gate asks and it genuinely does not apply. Each needs at least 20 characters of reason;
CI re-runs when you edit this description. Delete the lines you do not use.

No-ADR-reason: <!-- why this does not meet the ADR test in docs/decisions/0000 -->
No-docs-reason: <!-- why this change needs no spec or log entry -->

## Deliberately left out

<!-- What a reviewer might expect to see here and will not, with the reason. -->

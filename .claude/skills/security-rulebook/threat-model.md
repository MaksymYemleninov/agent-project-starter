# Threat model format

`docs/security/threat-model.md` is written at onboarding, phase 3, from the idea and the answers,
and kept current: a spec that adds an entry point, a data store or an integration updates it in
the same change. It is short on purpose. A threat model nobody rereads protects nothing.

Answer four questions, in this order. They are the classic ones, and they work because they force
the concrete before the clever.

1. **What are we building?** A small diagram and a list.
2. **What can go wrong?** Per entry point, using STRIDE as a prompt, not a form.
3. **What are we doing about it?** A control per threat, or an accepted risk with an ADR.
4. **Did we do a good job?** What was not considered, and when this is next reviewed.

## Shape

```markdown
---
type: security
status: draft
last_verified: YYYY-MM-DD
---
# Threat model

## Assets
What an attacker wants, ranked: user accounts, personal data (which fields), payment data, API
keys and tokens, the ability to act as another user, availability, the brand. For each: where it
lives and who may read it.

## Trust boundaries and entry points
An ASCII diagram. Every place untrusted data crosses into something trusted: public endpoints,
webhooks, file uploads, OAuth callbacks, message queues, admin panels, CI, third-party SDKs in the
browser. One row per entry point:

| Entry point | Who can reach it | Authentication | Data it accepts | Notes |
|---|---|---|---|---|

## Threats
Per entry point, the threats that actually apply. STRIDE is a checklist of questions:
Spoofing (can someone pretend to be another user or service?), Tampering (can they change data
they should not?), Repudiation (could they deny having done it?), Information disclosure (can
they read what they should not?), Denial of service (can they make it unavailable cheaply?),
Elevation of privilege (can they gain a role they should not have?).

| # | Entry point | Threat | Likelihood | Impact | Control | Status |
|---|---|---|---|---|---|---|
| T1 | POST /api/invoices/:id | Another customer reads an invoice by guessing the id (IDOR) | high | high | object-level authorization in the service layer; ids not sequential | planned |

Status: planned, in place (with the file or test that proves it), accepted (with the ADR).

## Abuse cases
The threats above written as they become spec criteria, so they get tested:
- If a user requests an invoice that belongs to another customer, the system shall return 404 and
  log the attempt.

## Out of scope and not considered
What this model deliberately does not cover (a nation-state attacker, physical access), and what
nobody has looked at yet. The second list is the honest one.

## Review
When this is next reviewed: at `/harden`, when a spec adds an entry point or data store, and at
least every six months while the project is live.
```

## Rules for writing it

- Real entry points and real data, named as the code will name them. "The API" is not an entry
  point.
- Likelihood and impact are high, medium or low, with a word of why when it is not obvious. No
  scores that pretend to precision.
- Every high-impact threat gets a control or an ADR accepting it. None stays at "planned" past
  `/harden`.
- Each abuse case becomes an EARS `If ...` criterion in the spec that implements the entry point.
  That is what makes the model testable instead of decorative.
- A control is "in place" only with evidence: the test, the middleware, the config line. Otherwise
  it is still planned.

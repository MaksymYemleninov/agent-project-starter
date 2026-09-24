# Security review checklist

Used by `security-reviewer` in diff mode (only the sections the diff touches) and audit mode
(every section). Each item gets PASS, FAIL, WARN or N/A with file and line. Organised by the areas
of OWASP ASVS; check the chosen level's requirements in the current ASVS for depth.

## 1. Architecture and data flow
- Does the change add an entry point, data store, integration or role not in the threat model?
  Then the threat model must change in the same diff.
- Trust boundaries in `docs/architecture/overview.md` still hold.

## 2. Authentication
- Passwords, if any, hashed with a current memory-hard algorithm through a maintained library,
  never a hand-rolled or fast hash. Check the library's current recommendation.
- Login, reset and signup resist enumeration (same response and timing for unknown accounts) and
  brute force (rate limit or lockout).
- Reset and verification tokens: random, single-use, short-lived, compared in constant time.
- Third-party login: state parameter checked, redirect URIs allowlisted, tokens validated
  (issuer, audience, expiry, signature).

## 3. Sessions and tokens
- Session cookies `HttpOnly`, `Secure`, `SameSite` set deliberately; rotated on login and
  privilege change; invalidated on logout server-side.
- Bearer tokens: short expiry, validated on every request, not stored in `localStorage` when a
  cookie would do.
- CSRF protection on every state-changing request that relies on cookies.

## 4. Access control
- Every new route, handler, job and resolver has an explicit authorization check. Default deny.
- Object-level checks: the resource belongs to the caller or their tenant, checked on the server
  for every read and write, including list and export endpoints and nested resources.
- Role and tenant come from the server-side session, never from the request body or a header the
  client sets.
- Admin functions are separated and audited.

## 5. Input validation and output encoding
- Input parsed with an allowlist schema at the boundary: type, length, range, format. Unknown
  fields rejected or dropped deliberately (mass assignment).
- SQL through parameters or a query builder; no string concatenation, including `ORDER BY` and
  identifiers.
- No shell, `eval`, template compilation or deserialization of untrusted input. Unsafe loaders
  (`pickle`, `yaml.load` without a safe loader, `torch.load` of untrusted files) are findings.
- HTML output auto-escaped; raw HTML insertion (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`)
  only with a sanitizer and a stated reason.
- Server-side requests to user-supplied URLs go through an allowlist (SSRF). File paths built from
  input are normalised and confined (path traversal).
- File uploads: size limit, type checked by content, stored outside the web root, served with a
  safe content type and `Content-Disposition`.

## 6. Cryptography and secrets
- No secret, key or token in the diff, in fixtures, in logs, in error messages, or in the client
  bundle (anything prefixed for public exposure by the framework is public).
- Randomness for security from a CSPRNG. Standard library crypto, no custom constructions.
- TLS everywhere outside localhost; no certificate verification disabled.

## 7. Errors, logging and monitoring
- Errors to clients are generic; details go to logs. No stack traces in production responses.
- Security events logged with actor, action, target and outcome, without passwords, tokens or
  unnecessary personal data.
- Logs cannot be injected into (newlines and control characters handled).

## 8. Data protection and privacy
- Personal data collected only as a spec criterion needs; retention stated; deletion possible.
- Sensitive data encrypted at rest where the platform allows, and never in URLs or analytics.
- Caching headers prevent sensitive responses being stored by shared caches.

## 9. HTTP and browser security
- Security headers set deliberately for the app: CSP, HSTS, `X-Content-Type-Options`,
  frame-ancestors, `Referrer-Policy`. Look up the current recommended values.
- CORS: explicit origins, never `*` with credentials.
- Open redirects: redirect targets allowlisted.

## 10. Dependencies and supply chain
- New dependency: an ADR or a stated reason, maintained, pinned, lock file committed, no install
  scripts doing surprising things.
- Scanner output (see scanners.md) has no unaddressed high finding.
- CI actions pinned; workflow tokens with least permissions; secrets not exposed to pull requests
  from forks.

## 11. Business logic and abuse
- Limits on anything that costs money or can be automated: sending email or SMS, creating
  accounts, expensive queries, AI calls.
- Race conditions on balances, quotas, coupons, inventory: checked atomically.
- Every abuse case in the spec has a test.

## 12. Infrastructure touched by the change
- If the diff touches infrastructure, the infra review checklist applies as well; here only
  check public exposure, IAM scope and secret handling.

## Report

```markdown
## Security review - <diff | audit> (YYYY-MM-DD)

Scope: files or areas reviewed. ASVS level: L1 | L2 | L3 (ADR NNNN).

### Findings
1. [HIGH] path:line - what an attacker does, step by step - the fix.
2. [MEDIUM] ...

### Checklist
Per section: PASS / FAIL / WARN / N/A, one line each.

### Not checked
What could not be checked and why: a scanner not installed, a service not reachable, code outside
the diff that the finding depends on.

### Rule gaps
Rules for `.claude/claude-security-guidance.md` or this checklist that would have caught a finding.

### Verdict
READY - no findings. | READY - N medium/low findings. | BLOCKED - N findings (any high).
```

Every high finding states the attack concretely: who, from where, doing what, getting what. A
finding without an attack path is a hunch, and belongs under WARN.

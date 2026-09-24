# Project security rules

Read by the `security-guidance` plugin on every LLM diff review, appended to its prompt. Keep it
under 8 KB: past that the tail is cut. Rules here are the ones specific to this codebase that a
reviewer cannot infer; the common vulnerability classes are already covered by the plugin.

`/onboard` phase 5 replaces this stub with rules drawn from `docs/security/threat-model.md` and the
ASVS level ADR. Examples of the shape, to be replaced:

- Every handler under the API layer calls the authorization helper with the resource it loads,
  before returning it. Checking only that a session exists is a finding.
- Tenant id always comes from the server-side session, never from the request.
- Outbound HTTP to a URL that came from a user goes through the SSRF allowlist wrapper.

Never put a secret in this file: it is sent to the model with every review.

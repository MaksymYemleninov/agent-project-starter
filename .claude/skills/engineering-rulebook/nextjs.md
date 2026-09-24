# Pack: Next.js

Read with [typescript.md](typescript.md): everything there applies. This file adds what is
specific to Next.js with the App Router. Next.js changes quickly between major versions; check
the current documentation for caching and rendering defaults instead of trusting memory, which is
exactly where agents are most confidently wrong.

## Layout

```
src/
  app/                       # routes only: pages, layouts, route handlers, loading/error states
    (marketing)/ ...
    (app)/dashboard/page.tsx
    api/<name>/route.ts      # route handlers: parse, authorize, call a feature, respond
  features/<feature>/        # the same feature structure as typescript.md
    actions.ts               # server actions for this feature ("use server")
    components/              # feature UI
    service.ts, repo.ts, schema.ts
  components/ui/             # design-system primitives, built from the design tokens
  lib/                       # config, auth helpers, db client
```

`app/` stays thin: a page composes feature components and calls feature functions. Business rules
in a `page.tsx` or `route.ts` are a finding.

## Server and client

- **Server components by default.** `"use client"` only on the smallest component that needs
  state, effects or browser APIs, pushed to the leaves of the tree. *Reviewed.*
- **Server-only code is marked.** Modules that touch the database, secrets or internal APIs import
  `server-only`, so importing them into a client component fails the build. *Build + lint.*
- **Only `NEXT_PUBLIC_` variables reach the browser**, and those are public by definition. A secret
  with that prefix is leaked. Config is parsed in `lib/config.ts` (server) and a separate public
  config for the client. *Reviewed, security-reviewer.*

## Server actions and route handlers are public endpoints

- **Every server action authenticates and authorizes inside the action**, on the object it touches.
  An action is callable by anyone who can send a POST, whether or not the UI shows a button for it.
  *Reviewed, security-reviewer.*
- **Every action and handler parses its input with a schema**, including `FormData`. *Reviewed.*
- **Proxy (formerly middleware) is not an authorization boundary.** Next.js 16 renamed
  `middleware.ts` to `proxy.ts`; its documentation says to verify authentication and authorization
  inside each server function rather than relying on proxy, because a matcher change or a moved
  action silently removes proxy coverage. Use proxy for redirects and cheap checks; enforce access
  in the action, handler or data layer. *Reviewed, security-reviewer.*
- Actions return a typed result for the form (`{ ok, errors }`), not thrown errors for expected
  failures.

## Data and caching

- Fetch data in server components or in feature functions they call, not in client effects, unless
  the data is truly client-only.
- **Caching is a decision per call.** Know whether a fetch or route is cached, for how long, and
  per whom. User-specific data must never land in a shared cache. Revalidate by tag or path after a
  mutation. State the choice in the code where it is not the default. *Reviewed.*
- One database client instance, created in `lib/`, reused across hot reloads in development.

## UI

- Components use the design tokens and primitives in `components/ui/`, never hardcoded colours,
  sizes or fonts (see the design track once it exists). *Lint + design-reviewer.*
- Every data-driven view has loading, empty and error states (`loading.tsx`, `error.tsx`, explicit
  empty UI). *Reviewed.*
- Images through `next/image`, fonts through `next/font`, links through `next/link`. *Lint
  (`@next/eslint-plugin-next`).*
- Accessibility: semantic elements, labels on inputs, keyboard reachable, visible focus. *Lint
  (`jsx-a11y`) + reviewed.*

## Tests

Unit and integration as in typescript.md; Playwright for the critical user paths end to end,
including one test per abuse case that crosses the UI (a user opening another user's page).

## Commands to put in AGENTS.md

The TypeScript set, plus `npm run build` (type and route errors surface here), `npm run e2e`.

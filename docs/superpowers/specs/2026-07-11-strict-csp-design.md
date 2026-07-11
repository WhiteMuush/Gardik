# Strict Content-Security-Policy - design

Date: 2026-07-11. Closes the "Strict CSP with nonces" item in
[production-readiness.md](../../production-readiness.md) (tracks #59).

## Goal

Ship an enforcing (not Report-Only) strict CSP with per-request nonces,
covering every HTML page including `/login`, without breaking auth
redirects, hydration, charts, drag-and-drop, or client-side PDF export.

## Decisions

- Pattern: per-request nonce generated in the middleware (official Next.js
  App Router approach). The nonce travels to Next via a request header, so
  the framework applies it to its own inline scripts; the response carries
  the enforcing `Content-Security-Policy` header.
- Enforcing from day one, validated locally (prod build click-through) and
  continuously by the step-4 smoke test. No Report-Only phase: the V1
  timeline has no production observation window.
- `style-src 'self' 'unsafe-inline'`: Tailwind and chart/DnD libraries set
  inline styles. Accepted trade-off; the script surface is the one that
  matters.
- Baseline headers stay in `next.config.ts` untouched. The CSP lives only
  in the middleware, the only place a per-request nonce can exist.
- API routes stay out of the matcher (JSON responses, no CSP needed).

## Directives

Production:

```
default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic';
style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:;
font-src 'self'; connect-src 'self'; worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'
```

Development additions: `'unsafe-eval'` in `script-src` (React Refresh) and
`ws:` in `connect-src` (HMR websocket). `worker-src blob:` covers
`@react-pdf/renderer` client-side export.

## Files

| File | Change |
| --- | --- |
| `src/lib/csp.ts` | New. Pure `buildCsp(nonce, dev)` returning the directive string. Separated from the middleware so vitest can cover it. |
| `src/lib/csp.test.ts` | New. Nonce presence, dev/prod differences, key directives. |
| `src/middleware.ts` | Generate nonce (`crypto.randomUUID()` base64-encoded via `btoa`), set it and the CSP on the request headers (Next reads the nonce from there), set the enforcing CSP on the response, keep the `auth()` wrapper. Widen the matcher. |
| `src/auth.config.ts` | `authorized` callback allows `/login` without a session (the widened matcher now covers it; without this, redirect loop). |
| `docs/production-readiness.md` | "Security headers review" -> Done; drop "Strict CSP with nonces" from the remaining list; update the headers section. |

## Matcher

```
/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\..*).*)
```

Includes `/login` (CSP applies there too); excludes API routes, static
assets, images, fonts, and any path with a file extension.

## Auth interplay

The `auth()` wrapper still runs first for redirects. Unauthorized requests
to protected pages get the usual redirect response (no body, CSP
irrelevant). `/login` returns `true` from `authorized` so the page renders;
previously the matcher skipped it entirely, so allowing it preserves
existing behavior.

## Error handling

None beyond framework guarantees. `buildCsp` is a pure string builder;
middleware failures surface as standard Next errors.

## Verification

- Unit: vitest on `buildCsp` (nonce embedded, `unsafe-eval`/`ws:` only when
  dev, `strict-dynamic` present, `frame-ancestors 'none'`).
- Real: `npm run build && npm start`, click through login, dashboard,
  alerts, reports (PDF export), settings, employees. Browser console must
  show zero CSP violations; response header present with a fresh nonce per
  request.
- Continuous: the step-4 Playwright smoke test runs against the enforcing
  CSP.

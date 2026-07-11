# Production readiness checklist

Tracks #59. Completed for v1.0.0; the README WIP banner is gone.

| Item | Status | Notes |
| --- | --- | --- |
| Stable Prisma migrations | Done | Migrations under `prisma/migrations`; deploy with `prisma migrate deploy`. Squashed baseline deferred (optional, post-v1). |
| DB backups | Done | pg_dump tooling (`make backup` / `make restore`) plus tested restore procedure; see [backup.md](backup.md). |
| Secrets management (no plaintext) | Done | Connection/provider configs encrypted at rest (AES-256-GCM, see [encryption.md](encryption.md)). Env secrets via the environment, never committed; CI secret scan enforces this. |
| Application healthcheck | Done | `GET /api/health` pings the DB; 200 `{status:"ok"}` / 503 on failure. |
| Logging policy (zero PII / secrets) | Done (policy) | See below. |
| Security headers review | Done | Baseline headers plus enforcing strict CSP with per-request nonces; see below. |

## Logging policy (zero PII / secrets)

- Never log decrypted configs, API keys, bearer tokens, or `encrypted*` fields.
- Never log employee emails or names except where strictly required; prefer ids.
- Provider/sync errors log the error message only, not the credentials or the
  request body.
- The healthcheck and cron endpoints return no PII.

## Security headers

Baseline headers are applied to every response in `next.config.ts`:
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`,
`Permissions-Policy` (camera/mic/geolocation disabled), and
`Strict-Transport-Security` (2y, includeSubDomains, preload).

A strict `Content-Security-Policy` is enforced by `src/middleware.ts`:
per-request nonce with `strict-dynamic` for scripts, `'self'` defaults,
`frame-ancestors 'none'`. Styles allow `'unsafe-inline'` (Tailwind and chart
libraries); the directive string is built by `src/lib/csp.ts`.

## Deferred post-v1

- Squashed migration baseline (optional).
- Broader e2e coverage beyond the login/dashboard/alerts smoke test.

# Production readiness checklist

Tracks #59. The README WIP banner stays until every item is **Done**.

| Item | Status | Notes |
| --- | --- | --- |
| Stable Prisma migrations | Partial | Migrations under `prisma/migrations`; deploy with `prisma migrate deploy`. No squashed baseline yet. |
| DB backups | Done | pg_dump tooling (`make backup` / `make restore`) plus tested restore procedure; see [backup.md](backup.md). |
| Secrets management (no plaintext) | Partial | Connection/provider configs encrypted at rest (AES-256-GCM, see [encryption.md](encryption.md)). Env secrets via the environment, never committed; CI secret scan enforces this. |
| Application healthcheck | Done | `GET /api/health` pings the DB; 200 `{status:"ok"}` / 503 on failure. |
| Logging policy (zero PII / secrets) | Done (policy) | See below. |
| Security headers review | Done (baseline) | See below; strict CSP still pending. |

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

Pending: a strict `Content-Security-Policy`. The App Router needs per-request
nonces for inline scripts/styles, so it is tracked as a follow-up rather than
shipped loose.

## Remaining before removing the WIP banner

- Squashed migration baseline (optional).
- Strict CSP with nonces.

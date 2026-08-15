# Better Auth migration (phase 1: TOTP)

## Context

Auth today runs on `next-auth@5.0.0-beta.31` (Auth.js v5) with a single
Credentials provider, JWT sessions, bcrypt password hashing, and custom
`role` / `companyId` claims. The surface is small and centralized:

- 23 API routes go through `src/lib/apiAuth.ts` (`requireAuth` / `requireAdmin`).
- 4 dashboard API routes import `auth` from `@/auth` directly.
- 15 `(dashboard)` server pages plus the layout call `auth()` to read session.
- 1 types file (`src/types/next-auth.d.ts`), 1 login page, 1 middleware.

The driver for this migration is two-factor authentication, required in a
professional / enterprise context (cyber insurance, ISO 27001, SOC 2). The
policy must be admin-configurable per company (multi-tenant), not a global
on/off. Next-auth Credentials cannot deliver 2FA without hand-rolling secret
storage, enrollment, verification, and recovery codes; Better Auth ships this
as a tested plugin.

## Goals (phase 1)

- Replace next-auth v5 with Better Auth, iso-functional for existing login.
- Preserve the existing multi-tenant model (`Company` / `User` / `role`);
  do NOT adopt the Better Auth `organization` plugin.
- Add a per-company auth policy: allowed methods + `require2fa`.
- Ship TOTP (authenticator app) with encrypted backup codes.
- Preserve existing seeded accounts (bcrypt hashes) with no forced reset.

## Non-goals (phase 1)

Architecture must leave room for these, but they are not coded now:

- Email OTP (wire `sendOTP` to `src/lib/email.ts` later).
- Passkeys / WebAuthn plugin.
- Active-session management UI ("log out everywhere").

Each follow-up ships as its own spec / plan / implementation cycle.

## Chosen approach: seam-preserving migration

Two other approaches were rejected:

- **Idiomatic rewrite** (adopt `organization` + `admin` plugins, drop the
  in-house multi-tenant model): large diff, discards working code, more
  surface to test, more risk on the critical path. Not justified.
- **Coexistence / strangler** (both auth systems behind a flag): forbidden by
  `AGENTS.md` (no feature flags, no compat shims) and oversized for ~44 lines
  of auth.

The seam-preserving approach keeps the existing chokepoints and swaps only
their internals, minimizing churn on the security-critical path.

## Architecture

New auth tree, one contact point on server and client:

- `src/lib/auth/server.ts`: `betterAuth()` instance with the Prisma pg
  adapter, `emailAndPassword` (custom bcrypt `hash` / `verify`), the
  `twoFactor` plugin, and `nextCookies`.
- `src/lib/auth/client.ts`: `createAuthClient()` + `twoFactorClient()` for the
  login and enrollment UI.
- `src/lib/auth/session.ts`: `getSession()` wraps
  `auth.api.getSession({ headers })` and returns the normalized shape
  `{ user: { id, email, role, companyId } }`. This is the ONLY server-side
  contact point with Better Auth.
- `src/app/api/auth/[...all]/route.ts`: `toNextJsHandler(auth)`, replacing
  the `[...nextauth]` route.

Seams preserved:

- `src/lib/apiAuth.ts` keeps `requireAuth` / `requireAdmin` and the
  `{ session, error }` return shape; only the internals call `getSession()`.
  The 23 API routes that already go through it do not change.
- The 15 `(dashboard)` pages plus the layout do a mechanical import swap
  (`@/auth` -> `@/lib/auth/session`) and call `getSession()` instead of
  `auth()`.
- `role` and `companyId` are exposed through `user.additionalFields` in the
  Better Auth config so they stay typed and are returned in the session.

## Prisma schema and data migration

Tables added: `Session`, `Account`, `Verification`, `TwoFactor`.

`User` is extended with the Better Auth required fields (`emailVerified`,
`name`, `updatedAt`, `image?`) while keeping `role` and `companyId`, plus
`twoFactorEnabled Boolean @default(false)`. The `hashedPassword` column is
removed from `User`.

`Company` carries the per-company auth policy:

- `require2fa Boolean @default(false)`
- `allowedAuthMethods AuthMethod[]` with `enum AuthMethod { TOTP EMAIL_OTP
  PASSKEY }`. Phase 1 seeds `TOTP`.

Data migration (raw SQL inside the Prisma migration): for each `User`, insert
an `Account` row (`providerId = "credential"`, `accountId = userId`,
`password = <existing bcrypt hash>`), then drop the `hashedPassword` column.
The seed scripts (`prisma/seed.ts`, `prisma/seed.dev.ts`) are rewritten to
create the `credential` account instead of setting `hashedPassword`.

Prisma 7 requires a custom output path for the generated client used by the
adapter. The Better Auth models are hand-written into `schema.prisma` (not the
Better Auth CLI) and validated with `prisma validate`.

## Sessions

Switch from JWT to database sessions (Better Auth default). This unlocks
revocation, "log out everywhere", and the trusted-device feature of the 2FA
plugin. The session cookie is httpOnly / secure / sameSite, handled by Better
Auth.

Middleware does an optimistic cookie check at the edge (`getSessionCookie`, no
DB access in edge) for route protection, with the full check happening in
server components and route handlers. The existing CSP nonce logic in the
middleware is kept unchanged.

## 2FA flow (TOTP + backup codes)

Enrollment (settings page): `twoFactor.enable({ password })` returns a
`totpURI` and backup codes; a QR is rendered from the URI; the user confirms
with `twoFactor.verifyTotp({ code })`, which flips `twoFactorEnabled`. Backup
codes are shown once and encrypted at rest (plugin default).

Login: the page handles `twoFactorRedirect: true` by prompting for a TOTP
code and calling `twoFactor.verifyTotp`. The session completes only after
verification.

Per-company enforcement (server-side, not UI-only): after a password sign-in,
if `company.require2fa && !user.twoFactorEnabled`, the user is forced to the
enrollment flow before any access is granted. An admin settings page (guarded
by `requireAdmin`) sets `require2fa` and the allowed methods.

## Types, security, rate limiting

- Remove `src/types/next-auth.d.ts`; infer types from Better Auth
  (`typeof auth.$Infer.Session`). `role` / `companyId` typed via
  `additionalFields`.
- Replace the hand-rolled `rateLimit` call in `authorize` with Better Auth's
  built-in rate limiting on sign-in.
- Passwords: existing bcrypt hashes preserved through custom `hash` / `verify`
  (bcryptjs), so the seeded `admin@datashield.local` logs in unchanged.
- TOTP secret and backup codes encrypted; CSRF and secure cookies native to
  Better Auth; 2FA enforcement is server-side.
- Env: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (mapped from the existing
  `AUTH_SECRET`). Update `.env.example` and `docs/auth.md`.

## Testing and gates

- Adapt the `apiAuth` guard tests (mock `getSession`).
- New tests: TOTP enable / verify, per-company policy enforcement, the
  `getSession` helper.
- e2e smoke: update the login flow; add a 2FA path.
- CI gates before PR: `lint --max-warnings 0`, `tsc --noEmit`,
  `prisma validate`, `build`.

## Risks

- Migration touches the authentication path; done on a branch with auth tests
  green before merge, never directly on `main`.
- The password data migration is one-way; verify the seeded admin logs in on a
  fresh DB before removing `hashedPassword`.
- Better Auth CLI does not run migrations for Prisma; schema is hand-written
  and applied with `prisma migrate`.

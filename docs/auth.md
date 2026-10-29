# Better Auth

Authentication uses [Better Auth](https://www.better-auth.com/), backed by
the project's Prisma/PostgreSQL database.

## Why Better Auth

- Sessions are database-backed: each sign-in creates a row in the `Session`
  table, so sessions can be listed, revoked, and audited server-side instead
  of relying only on a signed cookie.
- TOTP two-factor authentication is available per company via the `twoFactor`
  plugin, without a separate auth provider integration.
- Native App Router support (`nextCookies` plugin) keeps cookie handling
  correct for server actions and route handlers.

## Configuration

Set these in `.env.local` (see `.env.example`):

- `BETTER_AUTH_SECRET`: session/token signing secret. Generate with
  `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: base URL of the app. Defaults to `http://localhost:3000`.

## Password hashing

Passwords are hashed and verified with `bcryptjs` (already used elsewhere in
this project), configured explicitly on the `emailAndPassword.password`
option in `src/lib/auth/server.ts`, rather than Better Auth's default
hashing algorithm.

## Account identity

Better Auth resolves an account by `(providerId, accountId)`. Versions 1.7.0 to
1.7.2 keyed it on `(issuer, accountId)` instead, and 1.7.5 reverted that
because it broke databases created under 1.6.

The `issuer` column added by `20260902072500_add_account_issuer` is still on
`Account`, but nothing writes it any more:
`20261001090000_drop_account_issuer_requirement` made it nullable (a NOT NULL
column would make every sign-up fail) and moved the lookup index to
`(providerId, accountId)`. The backfilled values are kept on purpose, so an
image rolled back to Better Auth 1.7.2 still signs existing users in.

Code that writes an account row by hand (accepting an invitation, the seed
scripts) only needs `providerId`, `accountId` and `userId`, plus `password`
for a credential account.

## Two-factor authentication

The `twoFactor` plugin enables TOTP-based two-factor authentication.
Enrollment is per user; companies can require it for their members as part
of their auth policy.

## My account

`/security` is where a user manages their own account, behind a step-up (the
password or an authenticator code, valid five minutes). Every mutation below
checks that grant on the server, and an expired grant answers
`STEP_UP_REQUIRED` so the page asks again and replays the request.

- **Profile**: `PATCH /api/account/profile` changes the display name (1 to 100
  characters). Email, role and company are read-only.
- **Password**: `POST /api/account/password` accepts a forced rotation, or a
  self-service change when the user has two-factor enabled. Without 2FA the
  change stays with an administrator: step-up accepts the password alone, so a
  thief holding it could otherwise lock the owner out. Every other session is
  signed out, the caller's survives.
- **Sessions**: listed from the `Session` table, never exposing the token.
  `DELETE /api/account/sessions/[id]` signs out one session of the caller (404
  for anybody else's), `POST /api/account/sessions/revoke-others` all but the
  current one.
- **Audit**: these routes write their `AuditLog` row in the same transaction as
  the change. Two-factor and passkey changes are written by Better Auth hooks
  (`src/lib/auth/account-audit.ts`) right after the library commits them, so
  those rows share no transaction with the change.

## First administrator

A deployed image has no company and no account, and `disableSignUp: true` means
nobody can create one. `src/lib/auth/bootstrap.ts`, wired through
`src/instrumentation.ts`, closes that gap at start-up when
`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_INVITE_TOKEN` are both set.

It issues an invitation rather than setting a password. Validation, hashing,
email verification and the forced second factor already exist in
`invitation.ts` and `(auth)/secure`, and a second implementation of those rules
would eventually disagree with the first.

The token is supplied by the operator, not generated. A generated token would
have to be printed to be usable, and `production-readiness.md` forbids writing
secrets to the logs.

The gate asks whether any account carries a password, not whether any user
exists. The stricter-looking rule is the more fragile one: a link lost before use
would lock the operator out permanently. Testing for a password instead lets a
restart reissue the invitation, while still closing the door the instant anybody
can genuinely sign in.

## Migration note

This project previously used `next-auth` (Auth.js) v5 beta. The migration to
Better Auth replaces `AUTH_SECRET` / `AUTH_URL` with `BETTER_AUTH_SECRET` /
`BETTER_AUTH_URL` and moves session storage into the application database via
Prisma.

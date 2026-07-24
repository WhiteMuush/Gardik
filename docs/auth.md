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

## Two-factor authentication

The `twoFactor` plugin enables TOTP-based two-factor authentication.
Enrollment is per user; companies can require it for their members as part
of their auth policy.

## Migration note

This project previously used `next-auth` (Auth.js) v5 beta. The migration to
Better Auth replaces `AUTH_SECRET` / `AUTH_URL` with `BETTER_AUTH_SECRET` /
`BETTER_AUTH_URL` and moves session storage into the application database via
Prisma.

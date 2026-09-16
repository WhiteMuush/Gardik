# Production administrator bootstrap

## Context

A fresh production deployment of the published image cannot be signed into.
Three facts combine to close every door:

- `docker/entrypoint.sh` runs `prisma migrate deploy` and nothing else. The
  seed scripts never execute in the image.
- `disableSignUp: true` in `src/lib/auth/server.ts:241` refuses public
  registration, and `src/lib/auth/config.itest.ts` asserts it stays refused.
- `Company` rows are created in exactly two places, `prisma/seed.ts` and
  `prisma/seed.2fa.ts`. Neither ships, and no route or page creates one.

So the operator receives a container that migrates a database, starts a server,
and offers no company, no account, and no way to create either.
`docker/README.hub.md` documents no first-start step because none exists.

The local development seed (`admin@gardik.local` / `ChangeMe123!`, documented in
`README.md:141`) is a separate matter. It never reaches the image, and this
design does not change it.

## Goals

- Create the first company and administrator once, on a fresh deployment.
- Serve an operator at a terminal and an unattended deployment with one path.
- Never define a default credential, and never read a password from the
  environment.
- Never write a secret to the logs, so the policy in
  `docs/production-readiness.md` holds as written.
- Reuse the invitation, role preset and audit machinery already in the tree
  rather than restating any of it.

## Non-goals

These are real and tracked elsewhere. They are not part of this work:

- Hardening `prisma/seed.ts`: no `NODE_ENV` guard, and it rewrites the password
  on every run rather than only on create.
- The `compose.yml` dependency on `prisma/seed.dev.ts`, untracked since
  `55d761a` and absent from a fresh clone, which breaks `docker compose up`.
- Any user interface, HTTP route or CLI command.
- Provisioning more than one company. A deployment bootstraps one.

## Chosen approach: a start-up hook that issues an invitation

The bootstrap creates the company and the administrator, leaves the account
without a password, and issues a single-use invitation. The operator opens the
link and chooses a password through the application.

Two alternatives were rejected.

**A standalone script in the image.** The runner carries `node` and `sh` but no
npm, npx or tsx, and `bcryptjs` exists only inside the compiled Next bundles,
not as a resolvable module. Such a script would need `bcryptjs` copied into the
runner and would have to restate the password rules that
`src/lib/auth/invitation.ts` already owns. Two implementations of one rule set
diverge eventually.

**A `/setup` first-run page.** Familiar for self-hosted software, but it adds a
route and a user interface, and it opens a window between boot and first account
in which whoever reaches the URL first becomes administrator. Closing that window
requires a token anyway, which is the mechanism below without the extra surface.

The chosen approach adds no password handling of its own: validation, hashing and
the forced second factor are already implemented and tested in
`src/lib/auth/invitation.ts` and `src/app/(auth)/secure/page.tsx`.

## Design

### Placement

Two new files:

- `src/instrumentation.ts`, the Next 16 `register` hook, which calls the
  function below and nothing else.
- `src/lib/auth/bootstrap.ts`, exporting `bootstrapFirstAdmin()`.

Running inside the application process is what makes the approach small:
`prisma`, `issueInvitation`, `seedPresetsForCompany`, `resolvePresetRoleId`,
`writeAudit` and `appBaseUrl` are all importable. The Dockerfile, the entrypoint,
the route table and the component tree are untouched.

### Inputs

Both variables are required together:

| Variable | Meaning |
| --- | --- |
| `BOOTSTRAP_ADMIN_EMAIL` | Address of the first administrator. Arms the hook. |
| `BOOTSTRAP_INVITE_TOKEN` | Invitation token, supplied by the operator. 32 characters minimum. |

With neither set the hook returns silently and writes nothing: that is the
normal state of a running instance and of every development machine. With one set
and not the other it writes a refusal naming the missing variable, because that
combination is always a configuration mistake rather than a deliberate choice.

The company is derived from the address domain: `admin@acme.com` yields a company
named and domained `acme.com`. The name is editable afterwards through
`src/app/api/company/route.ts`, so nothing is locked in.

The token is supplied rather than generated so that the container never has a
secret to print. `openssl rand -base64 32` is the documented way to produce one,
matching what `docker/README.hub.md` already prescribes for every other secret.
A value shorter than 32 characters is refused, so a caller cannot weaken the
flow by passing something guessable.

### The gate

The hook does not ask whether a user exists. It asks whether anyone can already
sign in, which is a different and stricter question:

1. **No user at all.** Create the company, seed the role presets, create the
   administrator with the Administrator preset role and no credential account,
   issue the invitation.
2. **The administrator exists with no password set.** Issue a fresh invitation.
   `issueInvitation` already voids every outstanding invitation for that user, so
   this cannot leave two live links behind.
3. **Any account has a password.** Refuse, permanently.

State 2 is the reason the gate is worded this way. Under a plain "a user exists"
rule, a link lost or expired before use locks the operator out with no recovery
short of dropping the database. Resuming is safe because the door closes the
moment anyone can genuinely authenticate, which is the property that matters.

### Credential delivery

No password is ever set by the bootstrap. The operator opens
`<BETTER_AUTH_URL>/invite?token=<BOOTSTRAP_INVITE_TOKEN>`, which is the existing
page at `src/app/(auth)/invite/page.tsx`. Consuming the invitation sets the
password under the application's own rules, marks the address verified and
clears `mustChangePassword`. If the company requires a second factor,
`/secure` then walks the operator through enrollment before the dashboard opens.

Invitation tokens are 32 random bytes, stored only as a SHA-256 digest. The
bootstrap uses a dedicated `BOOTSTRAP_INVITATION_TTL_HOURS = 24` rather than the
72 hours used for inviting a colleague: a deployment is finished in one sitting
or the next morning, and state 2 makes an expired link recoverable by a restart,
so the shorter window costs the operator nothing.

### Logging

The hook writes two lines and never a secret:

```
[bootstrap] Created company acme.com and administrator admin@acme.com.
[bootstrap] Open <BETTER_AUTH_URL>/invite with the token you supplied.
```

The administrator address is the one the operator typed into their own
configuration, so printing it discloses nothing and is covered by the "except
where strictly required" clause of the logging policy. The token is never
printed, which is why it is supplied rather than generated.

### Audit

Two entries through `writeAudit`, reusing the closed vocabulary in
`src/lib/rbac/audit.ts`: `AUDIT_ACTIONS.USER_CREATE` and
`AUDIT_ACTIONS.USER_INVITE`, both with `actorUserId: null`. The column is already
nullable and a null actor already reads as "system", so no new action constant is
introduced and the audit trail and any future SIEM export render these without
changes.

### Failure and concurrency

`bootstrapFirstAdmin()` never throws. A half-supplied pair, a short token, a
malformed address, an unreachable database, or a replica that starts with
`RUN_MIGRATIONS=false` before the schema is ready: every one is logged as a
refusal and the server starts regardless. A failed bootstrap must not turn a
running instance into a dead one.

Creation happens in a single transaction. Two replicas starting together cannot
produce two administrators: the unique constraint on `Company.domain` fails the
second, which is caught and logged like any other refusal.

## Changes to existing code

`src/lib/auth/invitation.ts`, three edits, each of them a widening so every
existing call site keeps compiling untouched:

- `issueInvitation` accepts `createdByUserId: string | null`. The database column
  is already nullable, so this is a TypeScript signature change only.
- `issueInvitation` accepts an optional `token`, defaulting to `generateToken()`.
  The bootstrap has to supply its own, because a token the container generated
  would have to be printed to be usable, and that is the one thing the logging
  policy rules out.
- `issueInvitation` accepts an optional `ttlHours`, defaulting to
  `INVITATION_TTL_HOURS`, so the bootstrap can pass its shorter window without a
  second code path.

Nothing else in the tree changes.

## Testing

Integration tests against a real database, following the existing `.itest.ts`
pattern and `vitest.integration.config.ts`:

- Each of the three gate states, including that state 3 refuses even when the
  variables are present.
- A token below 32 characters is refused and nothing is written.
- Either variable alone is refused, names the missing one, and writes nothing.
- Neither variable set returns silently, with no log line and nothing written.
- Two consecutive calls in state 1 produce exactly one company and one user.
- A failing transaction leaves no partial company, role or user behind.
- A thrown error inside the hook does not propagate out of `register()`.

## Documentation

Three files, no new page and no change to the index at `README.md:222-226`.

- `docker/README.hub.md`: a top-level "First administrator" section between
  "Quick start" and "Configuration", plus the two variables in the optional
  table and `BOOTSTRAP_ADMIN_EMAIL` in the compose example. This file is synced
  to Docker Hub by `docker-publish.yml` on every release, so it is the page an
  operator reads first.
- `docs/auth.md`: a "First administrator" section covering the design rationale,
  why an invitation rather than a password, and why the gate tests for a password
  rather than for a user.
- `docs/production-readiness.md`: a line under the logging policy recording that
  the bootstrap link is never written and that its token comes from the
  environment, so a later change cannot regress the policy unnoticed.

# Enterprise SSO (OIDC lean) Design

**Date:** 2026-08-05
**Status:** approved in brainstorming, not yet implemented
**Supersedes (partially):** `2026-07-25-identity-access-rbac-design.md`, SSO sections only. See "Deviations" below.

## Goal

Let a client company bring its own identity provider (Azure AD, Okta) and have
its members sign in to DataShield through it, while identity stays self-hosted:
Better Auth remains the source of truth, the `User` row and its `Role` are ours,
and the IdP only proves who the person is.

Scope is OIDC only. SAML stays out until a client asks for it.

## Decisions locked during brainstorming

1. **Provisioning is strict pre-provisioning, no JIT.** An SSO login for an
   unknown email fails. An admin creates the account first.
2. **A pre-provisioned account is an SSO-only shell**: email, name, role, no
   password credential, no invitation email, no temporary secret.
3. **Routing is by the user, not by the claimed domain.** The login page
   resolves the `User` from the typed email, then that user's company, then
   that company's provider.
4. **Domain ownership is proven by DNS TXT**, using the plugin's own
   `domainVerification` feature. This is not optional, see "Why domain
   verification is mandatory".
5. **`sso mandatory` is per company, with a per-user exemption.** When the
   policy is on, local password sign-in is refused for that company's users
   unless the user carries `ssoExempt`.
6. **Implementation is `@better-auth/sso`** plus two additions of ours: the
   client secret is encrypted at rest, and the plugin's provider-management
   endpoints are placed behind our RBAC guard.

## Why domain verification is mandatory

This is the constraint that shapes the whole design, and it is not a preference.

A pre-provisioned user has no `Account` row for the SSO provider before the
first login, so the callback must link one. That linking decision lives in
`node_modules/better-auth/dist/oauth2/link-account.mjs`, in
`handleOAuthUserInfo`:

```js
const isTrustedProvider = opts.isTrustedProvider
  || (opts.trustProviderByName !== false && c.context.trustedProviders.includes(account.providerId))
if (!isTrustedProvider && !userInfo.emailVerified || ...) {
  return { error: "account not linked", data: null }
}
```

The SSO plugin calls it with `trustProviderByName: false`, which disables the
static `trustedProviders` list, and it computes `isTrustedProvider` from a
single source:

```js
const isTrustedProvider = "domainVerified" in provider
  && provider.domainVerified === true
  && validateEmailDomain(userInfo.email, provider.domain)
```

So without a verified domain, the first SSO login of a pre-provisioned user
fails with `account not linked`. Strict pre-provisioning and "no domain
verification" cannot both hold on this plugin.

The verification itself is already implemented upstream: `/sso/request-domain-verification`
issues the token, `/sso/verify-domain` resolves `TXT <identifier>.<domain>` and
flips `domainVerified`. Our work is the screen that shows the record and its
state. `parseProviderDomains` accepts several domains per provider, so a company
with multiple mail domains is covered.

We also set `account.accountLinking.requireLocalEmailVerified: false`. The trust
that permits linking comes from the verified domain, not from flipping
`emailVerified` to true on an address nobody ever confirmed.

## Architecture

### Data model

The plugin owns its table; we declare it in Prisma as `SsoProvider` with the
field names Better Auth expects: `issuer`, `oidcConfig`, `samlConfig`, `userId`,
`providerId`, `organizationId`, `domain`, `domainVerified`.

The link to our tenant is `organizationId`, holding our `companyId`. This is
safe because `assignOrganizationFromProvider` returns immediately on
`if (!ctx.context.hasPlugin("organization")) return`, and the organization
plugin is not installed. Reusing the existing column keeps `/sso/register`
working unmodified; adding a required column of our own would break its inserts.

Ours:

- `Company.ssoMandatory Boolean @default(false)`
- `User.ssoExempt Boolean @default(false)`

The `AuthMethod` enum is untouched. It is the vocabulary of second factors; the
SSO policy is a separate, explicit flag.

**One active provider per company in v1.** Enforced by our API route, not by the
plugin. Multi-IdP per company is deferred.

### Secret at rest

`oidcConfig` is a JSON string that carries `clientSecret`. A Prisma client
extension scoped to the `ssoProvider` model encrypts it with `encryptConfig`
on create and update, and decrypts it with `decryptConfig` on reads
(`src/lib/directory/crypto.ts`, AES-256-GCM, the same helpers the directory
connectors use). The plugin only ever sees plaintext; the database only ever
holds ciphertext.

### Permission gate

The catalog already carries `sso:read`, `sso:config` and `sso:role_map`
(`src/lib/rbac/permissions.ts`), and the presets already distribute them:
Administrator and Security Manager hold `sso:read` and `sso:config`, SOC Analyst
and Viewer hold `sso:read` only. Nothing to add.

The plugin exposes provider management to any authenticated session, which would
let a Viewer enroll an IdP on their own company. We extend the existing
`hooks.before` in `src/lib/auth/server.ts`, next to `enforceAllowedMethod`, with
a second path map:

| Path | Required permission |
| --- | --- |
| `/sso/register` | `sso:config` |
| `/sso/update-provider` | `sso:config` |
| `/sso/request-domain-verification` | `sso:config` |
| `/sso/verify-domain` | `sso:config` |

The check resolves the session, then goes through the normal RBAC path, so a
role edited a second earlier is honoured.

The plugin already guards discovery against SSRF: `assertEndpointResolvesPublic`
classifies every resolved address per RFC 6890 and rejects non-public ones, with
`trustedOrigins` as the documented escape hatch for an internal IdP. We do not
duplicate `src/lib/ssrf.ts` there.

## Login flow

```
1. /login: the user types an email and submits step one
2. POST /api/sso/resolve -> find the User, then its company, then that
   company's verified provider
3. { providerId } -> the client calls signIn.sso({ providerId, callbackURL })
   { sso: false } -> the page reveals the password field
4. Redirect to the IdP, which runs its own MFA
5. GET /sso/callback/:providerId: the plugin validates the id_token against the
   JWKS (issuer, audience, expiry, nonce, PKCE), links the account because the
   domain is verified, and opens the session
```

`disableImplicitSignUp: true` and `requestSignUp` is never sent, so an unknown
email creates nothing. That is the strict pre-provisioning, enforced by the
plugin rather than by us.

`/api/sso/resolve` answers with a constant shape and goes through
`rateLimit()` from `src/lib/rateLimit.ts`, the Postgres-backed limiter, to blunt
account enumeration. The two-step login
page reveals whether an address is enrolled; that is accepted, and rate limiting
is the mitigation.

SSO sessions do not run the local second factor: the `twoFactor` plugin hooks
password sign-in, and MFA is the IdP's job in this path. `Company.require2fa`
therefore does not apply to SSO sign-ins.

## Tenant isolation

The attack to defeat: company A's IdP asserting the email of a user who belongs
to company B, which would hand A a session on B's data.

The `provisionUser` hook, with `provisionUserOnEveryLogin: true`, compares
`user.companyId` to `provider.organizationId` on every single login. On a
mismatch it deletes the freshly created session row and throws. The position in
the flow is what makes this work: in the plugin's OIDC callback, `provisionUser`
is awaited **before** `setSessionCookie`, so no cookie is ever emitted.

Making it run on every login, not only at registration, turns it from a
provisioning detail into a per-request invariant.

## SSO mandatory policy

The same `hooks.before` covers `/sign-in/email`. The user is resolved from the
email in the request body; if `company.ssoMandatory` is true and the user is not
`ssoExempt`, the call is refused with a message that names the policy instead of
a generic failure.

`ssoExempt` is the anti-lockout valve. An expired IdP certificate or a broken
config must not lock a whole company out of its own security product. The flag
is writable only with `users:manage`, and setting or clearing it is audited like
any other RBAC mutation.

This is a stopgap, not the emergency-access design. The break-glass account with
its ops-held secret, time-boxed activation and alerting remains RBAC Plan 4.

## User pre-provisioning

`POST /api/users`, guarded by `users:manage`:

- input: email, name, `roleId` chosen among the company's assignable roles
- creates a `User` with the session's `companyId`, no password credential, no
  linked account
- writes an audit entry with the same before/after diff shape as role changes
- the UI is a form on the existing `/access` users table

An account created this way cannot sign in until its company has a verified SSO
provider. The form states that plainly rather than creating a silently unusable
account.

## Error handling

Plugin failures come back as redirect parameters on the error callback URL
(`error`, `error_description`). `/login` maps the ones a real user can hit to
readable text: `account not linked` (domain not verified yet), `signup disabled`
(the account was never pre-provisioned), `invalid_provider` (discovery or token
validation failed), plus a generic fallback. The raw code is logged server-side,
never shown.

## Testing

**Unit**
- the Prisma encryption extension: round trip, and a read of a row written
  outside the extension fails loudly rather than returning garbage
- provider resolution from an email, including unknown user and unverified
  domain
- the permission map and the mandatory-SSO decision, table driven

**Integration (Postgres)**
- `/sso/register` refused for a role without `sso:config`, accepted for
  Administrator
- the stored `oidcConfig` column is unreadable without the key
- password sign-in refused when `ssoMandatory`, accepted for an `ssoExempt` user
- the cross-tenant guard: a provider of company A presenting an email of
  company B leaves no session and no cookie
- `POST /api/users` creates a passwordless shell user and one audit row

**Full OIDC round trip**
A stub IdP inside the test process: a local HTTP server serving discovery and
JWKS, signing an `id_token` with `jose`. It exercises the real callback,
including signature and issuer validation, without depending on Azure or Okta.
Preferred over an e2e run because the failure modes worth covering are
server-side.

## Deviations from the 2026-07-25 identity-access design

That document locked SSO decisions that this one changes. The changes are
deliberate.

| 2026-07-25 | Now | Why |
| --- | --- | --- |
| JIT provisioning, first login upserts a pending user | Strict pre-provisioning, unknown email is refused | Chosen 2026-08-05: no account should exist that an admin did not create |
| Custom `SsoConnection` model with `emailDomains[]`, `defaultRoleId`, `groupRoleMap` | The plugin's `ssoProvider` table, `organizationId` carrying our `companyId` | Avoids maintaining a parallel schema the plugin will not read; `defaultRoleId` is pointless once the admin picks the role at creation |
| Multi-IdP per company | One provider per company in v1 | YAGNI until a client needs two |
| OIDC and SAML in v1 | OIDC only | SAML on demand |
| Group to role mapping as an opt-in mode | Deferred | `sso:role_map` stays in the catalog for it |
| Break-glass account as part of this slice | `User.ssoExempt` now, break-glass stays Plan 4 | A cheap anti-lockout valve does not require the full emergency-access machinery |

Everything that document says about RBAC, the permission catalog, the central
guard, anti-escalation and the audit log is unchanged and already shipped.

## Out of scope

SAML, LDAP login, IdP group to role mapping, SCIM deprovisioning of `User`
records, multi-IdP per company, invitation emails, and the break-glass account.

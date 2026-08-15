# Identity, Access, and RBAC design

Design for how login accounts (Users) authenticate and what they may do in
DataShield. Users sign in through their company's Active Directory / IdP (no
self-signup); roles and permissions are defined and assigned inside DataShield
by authorized people only. A sealed local break-glass account exists for the
case where SSO is unavailable.

This is scoped as one subsystem. Analyst handoff / alert ownership ("passer la
main") is deliberately out of scope and gets its own spec later; the role model
here anticipates it (an `alerts:assign` permission exists).

## Context and current state

- Login today: local `User` accounts (email + password + TOTP/EMAIL_OTP/passkey
  from the auth-methods work). Only a seeded admin exists. No self-signup UI, no
  team/invite flow.
- `Role` is an enum (`ADMIN`, `VIEWER`) checked ad hoc via `isAdmin` across
  routes and pages.
- Directory sync (`DirectoryConnection`, SCIM) already exists but targets
  `Employee` records (the monitored people), authenticating **as the app** to
  read a directory. That plane is unrelated to login and is not changed here.
- Providers already supported by directory sync: Azure AD / Entra, Google
  Workspace, LDAP, AWS (Identity Center), Okta, SCIM 2.0. Login SSO follows the
  same provider set.

### Three separate authentication planes

1. **Interactive login SSO** (new): a User proves identity through the company's
   IdP (OIDC or SAML) and gets a DataShield session.
2. **Break-glass local login** (reuses password + passkey/2FA): sealed accounts,
   normally locked, for emergency access when SSO is down.
3. **Directory sync** (existing, untouched): app-as-itself reads `Employee`s.

Keeping these separate is a security property: an SSO identity can never log
into a local/break-glass account, and the directory-read credentials never grant
a login.

## Decisions (locked during brainstorming)

- **Multi-IdP per company**, matching the existing connector set. Login SSO via
  the `@better-auth/sso` plugin (OIDC + SAML in one plugin). LDAP login is a
  credential-bind flow with different security properties and is deferred to a
  later phase; v1 is OIDC/SAML.
- **Provisioning = JIT for identity only.** First SSO login upserts a `User` in
  a **no-access "pending" state by default** (no permissions until granted); a
  connection may instead set a least-privilege default role (`Viewer`) via
  `SsoConnection.defaultRoleId`. An authorized admin then assigns the real role
  **inside DataShield**. IdP
  group->role auto-mapping is an opt-in secondary mode per connection, off by
  default. Azure App Roles / claim-driven roles are a possible later option, not
  in v1, because roles are managed in DataShield.
- **RBAC = customizable roles built from a granular permission catalog**, with
  seeded presets. Roles are per-company DB entities. This is the Azure-inspired
  "custom roles" model, with strict anti-escalation rules (below).
- **Authorization = a single central guard** `authorize(user, permission)` over
  a static, code-defined permission catalog. Default deny. Every mutating route
  or action must declare and check a permission.
- **Break-glass** is armed only from a CLI/server path that requires an
  ops-held secret, then still requires the account's own password + passkey/2FA,
  is time-boxed, audited, alerted, and auto re-locks.
- Offboarding for v1 relies on SSO-only + short sessions + immediate
  admin-triggered disable. SCIM deprovisioning of Users is a Phase-2 hardening.

## Permission catalog (code-defined, fixed vocabulary)

Permissions are `domain:action` strings. The catalog is a constant in code, not
a DB table; a role's `permissions` must be a validated subset of it. New
features add their own `domain:action`. Namespaced so a domain can be subdivided
later without breaking a role that holds the broader grant.

- **Alerts (SOC core)**: `alerts:read`, `alerts:assign`, `alerts:status`,
  `alerts:comment`, `alerts:close`, `alerts:remediate`
- **Employees (monitored)**: `employees:read`, `employees:manage`,
  `employees:scan`
- **Exposure register**: `register:read`, `register:manage`, `register:evidence`
- **Dashboard**: `dashboard:read`, `dashboard:customize`,
  `dashboard:manage_shared`
- **Reports**: `reports:read`, `reports:export`, `reports:schedule`
- **Directory connectors**: `connectors:read`, `connectors:manage`,
  `connectors:sync`
- **Data API**: `api_credentials:read`, `api_credentials:manage`
- **Notifications**: `notifications:read`, `notifications:manage`
- **Security policy**: `policy:read`, `policy:manage`
- **Identity / IdP**: `sso:read`, `sso:config`, `sso:role_map`
- **RBAC**: `users:read`, `users:manage`, `roles:read`, `roles:manage`
- **Audit**: `audit:read`

`sso:config` (configuring the IdP connection) is deliberately separate from
`sso:role_map` (deciding which IdP group becomes which role), because the map
controls who can become admin.

## Roles (customizable, per company, with presets)

`Role` is a per-company entity: `name`, `description`, `permissions[]`,
`isSystem`, `isAssignable`. Seeded presets:

- **Administrator**: all permissions. `isSystem`, immutable, non-deletable
  (prevents lockout and prevents weakening the top role).
- **Security Manager**: `policy:*`, `connectors:*`, `sso:config`, `sso:read`,
  `users:manage`, `reports:*`, all `:read`. Not `roles:manage`, not
  `sso:role_map`.
- **SOC Analyst**: `alerts:*`, `employees:scan`, `register:*`, `reports:read`,
  `reports:export`, all `:read`.
- **Viewer**: every `*:read` only.

Admins with `roles:manage` may create custom roles from the catalog and edit
non-`isSystem` roles.

### Anti-escalation invariants (first-class requirements)

1. Editing a role requires `roles:manage`; assigning a role requires
   `users:manage`; editing the group->role map requires `sso:role_map`.
2. **No-escalation rule (core):** an actor can never put into a role, assign, or
   map a permission they do not themselves hold. Blocks "mint a super-role, then
   grant it to yourself".
3. Administrator is immutable, non-deletable, always holds all permissions.
   Never allow deleting the last user holding it.
4. The crown-jewel permissions (`roles:manage`, `users:manage`, `sso:role_map`,
   `sso:config`) can only be granted by an actor who already holds them (rule 2).
5. A role assigned to users cannot be deleted (reassign first).
6. **Step-up re-auth**: sensitive RBAC mutations (create role, grant a
   crown-jewel permission, assign Administrator, edit the group->role map)
   require a fresh re-authentication (passkey/2FA re-prompt), verified
   server-side. A stolen live session cannot silently escalate.
7. Roles/permissions are never taken from client input; the effective role is
   read from `User.roleId` in the DB on every request.
8. Every RBAC/SSO/policy/break-glass mutation is written to an append-only audit
   log (actor, target, before/after, ip, time).

## Authorization enforcement

- A single `authorize(user, permission): boolean` (and a throwing
  `requirePermission`) resolves `User.roleId -> Role.permissions -> check`.
- **Default deny.** Every mutating route/action calls `requirePermission`. The
  existing `isAdmin` checks migrate to specific permissions.
- **Route->permission registry:** a declared mapping of every mutating API route
  and server action to the permission it needs. A test fails the build if a
  mutating route has no declared permission, so no surface is silently
  unguarded.
- Every query is scoped by `session.user.companyId`; a `roleId`/`userId` from a
  request must resolve within the caller's company.
- Client-side `authorize` is display-only; the server is the sole guard.

## SSO + JIT login flow

```
1. User -> /login -> "Sign in with <company IdP>"
2. Redirect to IdP (OIDC authorize with PKCE / SAML AuthnRequest)
3. IdP authenticates (MFA on the IdP side) -> callback with signed claims
4. @better-auth/sso validates: signature (JWKS/cert), issuer, audience, expiry,
   nonce (OIDC) / Conditions, Recipient, NotOnOrAfter, InResponseTo (SAML)
5. Resolve company via the SsoConnection (verified emailDomains + issuer)
6. JIT upsert User (email, name). New user -> no-access pending, unless the
   connection sets a default role. If assignmentMode = GROUP_MAP and a group
   matches -> that role (still bounded by the map, which is itself guarded).
7. Create a short-lived session; authorize() reads role->permissions per request
8. A no-access user lands on a "waiting for a role assignment" screen
```

Security properties: role is never derived from client input; all claims are
validated server-side; the company is resolved from the connection, not from a
user-asserted email domain; offboarding is covered by SSO-only + short sessions
+ admin disable.

## Break-glass

- The account: a `User` with `isBreakGlass = true`, `locked = true` by default,
  local credentials (password + passkey/2FA), not derived from any claim.
- **Arming (CLI/server only, no web path):** `break-glass:arm` requires the
  ops-held `BREAK_GLASS_SECRET` (never in app config/UI) plus a reason. It writes
  an activation with `armedUntil = now + 15 min` and emits an audit entry plus an
  alert (admin email/webhook + SIEM). Defense in depth: arming needs both shell
  access and the secret; neither alone suffices.
- **Login during the window:** the break-glass account can use the local login
  path only if a valid activation exists AND password + passkey/2FA succeed.
- **Re-lock:** automatically at `armedUntil`, on `break-glass:disarm`, or once a
  healthy SSO admin session is observed. The break-glass session is capped to the
  window.
- Every arm/login/action by the account is audited and alerted; failed arm and
  failed login attempts are rate-limited and alerted; the secret is rotated after
  use (documented runbook).

## Data model (Prisma)

- **`SsoConnection`** (per company): `protocol (OIDC | SAML)`, `name`,
  `issuer`/`metadataUrl`, `encryptedConfig` (clientId/secret or SAML
  cert/entityID), `emailDomains[]`, `assignmentMode (MANUAL | GROUP_MAP)`,
  `groupRoleMap` (JSON group->roleId), `defaultRoleId`, `status`, timestamps.
  Config encryption reuses the `DirectoryConnection` pattern.
- **`Role`** (per company): `name`, `description`, `permissions String[]`,
  `isSystem`, `isAssignable`, timestamps. Unique `(companyId, name)`.
- **`User`** changes: replace the `role` enum with `roleId String?` + relation;
  add `isBreakGlass Boolean @default(false)` and `locked Boolean @default(false)`.
  Migration maps `ADMIN -> Administrator`, `VIEWER -> Viewer` presets, seeded per
  company.
- **`BreakGlassActivation`**: `armedUntil`, `armedByReason`, `createdAt`.
- **`AuditLog`**: `companyId`, `actorUserId`, `action`, `targetType`,
  `targetId`, `before` / `after` JSON, `ip`, `createdAt`, indexed. Append-only:
  no update/delete API.
- Permission catalog lives in code (a union/const), not the DB.

The enum->table change touches every `session.user.role` / `isAdmin` usage; that
refactor to `authorize()` is part of the work.

## Threat model / attack surface

### A. Privilege escalation (RBAC)
- Edit/assign/map a permission the actor lacks -> no-escalation rule (subset of
  actor's permissions).
- Weaken/delete Administrator or the last admin -> immutable, non-deletable,
  last-admin guard.
- Tamper the group->role map to self-map admin -> `sso:role_map` guard +
  no-escalation on mapped roles + step-up + audit/alert.
- Client-supplied role/permission (cookie/JWT/body) -> role always read from DB
  per request; session carries only a user id.
- IDOR / mass-assignment (other company's user, arbitrary `roleId`) -> companyId
  scoping; `roleId` must be same-company, `isAssignable`, within no-escalation.

### B. SSO / federation
- Token/assertion forgery -> validate signature, issuer, audience, expiry,
  nonce (OIDC), Conditions/Recipient/NotOnOrAfter (SAML).
- SAML XSW / unsigned assertion / XXE -> require signed assertion, signature
  covers the assertion, canonicalization, DTD/external entities disabled, pinned
  cert.
- Replay -> PKCE (OIDC), one-time nonce, NotOnOrAfter window, consumed-assertion
  cache.
- Tenant confusion (attacker IdP asserts a victim email) -> company resolved by
  the connection + owned/verified `emailDomains`, not by the asserted domain.
- Open redirect / RelayState / redirect_uri -> strict callback allowlist, signed
  RelayState.
- Email collision into a local/break-glass account -> SSO cannot log into local
  accounts; no merge.
- Downgrade to local login -> local login disabled except sealed break-glass.

### C. Break-glass
- Web arming -> none; CLI + secret only.
- Stolen secret alone -> also needs shell access; rotated after use.
- Long window / silent use -> short time-box, auto re-lock, capped session,
  mandatory audit + alert.
- Brute force during the window -> passkey/2FA required + rate-limit + lockout +
  alert.

### D. Session / auth plane
- Fixation / hijack -> session rotation on login, httpOnly/secure/sameSite
  cookies, short TTL.
- Offboarding -> SSO-only + short sessions + admin disable revokes sessions.
- Step-up bypass -> re-auth re-verified server-side per sensitive mutation.
- CSRF -> origin/CSRF checks on mutating routes.

### E. Enforcement gaps
- A mutating route without `authorize()` -> default deny + route->permission
  registry + a build-failing coverage test.
- Client-only gating -> server always enforces.
- Missing company scope -> companyId filter everywhere + cross-tenant tests.

### F. Data / injection / secrets
- XXE/SSRF via SAML metadata URL -> external entities off, metadata URL
  allowlist, no arbitrary server-side fetch.
- Secrets at rest (client secret, SAML keys) -> `encryptedConfig`, never
  returned to the client.
- Audit tampering -> append-only, no delete/update API.
- Injection in role names / permission strings -> permissions validated against
  the catalog, role name sanitized.

### G. Supply chain / config
- Dependency CVEs (`@better-auth/sso`, `samlify` has a history) -> pinned
  versions, `npm audit`, overrides (existing repo pattern).
- Unsafe defaults -> secure defaults: `assignmentMode = MANUAL`, least-privilege
  default role, unmapped group = Viewer/deny, break-glass locked.

## Testing (security-focused, fail closed)

- **Unit**: claim->role mapping (pure), `authorize()` matrix, the no-escalation
  rule (property test: never grant a permission the actor lacks), `permissions`
  subset-of-catalog validation.
- **Integration** (real DB, in-process, as in the auth-methods work): privesc
  attempts return 403 (edit a role to add an unheld permission; assign a higher
  role; map a group to admin without holding it; edit another company's user).
  SSO: forged/expired/replayed/wrong-issuer/wrong-domain assertion rejected.
  Break-glass: locked by default; refused when not armed; refused without 2FA;
  allowed only when armed + credentials; re-locks after the window. Step-up: a
  sensitive RBAC mutation without fresh auth is challenged.
- **Authorization coverage**: a test over the route->permission registry that
  fails the build if any mutating route declares no permission.
- **e2e (CI)**: SSO login happy path via a stub IdP, role-assignment UI,
  break-glass path.
- **Negative-first**: for every invariant, a test asserting it fails closed.

## Out of scope (future phases)

- Analyst handoff / alert ownership (separate spec).
- LDAP interactive login (credential bind).
- SCIM deprovisioning of login Users.
- Azure App Roles / claim-driven role definitions.

# Auth methods policy: enforcement + EMAIL_OTP + PASSKEY

Makes `Company.allowedAuthMethods` (and the existing `require2fa`) a real
policy instead of a decorative field, then adds the two methods the enum
already reserves. Built on `develop`, phase by phase, small commits, validated
at each step.

Current state: only TOTP is a real second factor. `allowedAuthMethods` is
stored and shown in settings but read nowhere. Enum: `TOTP`, `EMAIL_OTP`,
`PASSKEY`.

## Phase A: enforce allowedAuthMethods (no new methods)

Block enrolling a method the company has not allowed, server-side.

- Add a Better Auth `hooks.before` (`createAuthMiddleware`) in
  `src/lib/auth/server.ts` that maps an enrollment endpoint to the method it
  enables (`/two-factor/enable` -> `TOTP`) and throws `APIError("FORBIDDEN")`
  when that method is not in the caller's `Company.allowedAuthMethods`.
- Resolve the caller via `getSessionFromCtx`; look up the company policy.
- Gate the enrollment UI too (`TwoFactorSetup`) so a disallowed method is not
  offered, but the server hook is the real guard.
- Validate live: exclude TOTP -> enable returns 403; include TOTP -> works.
- Commit: `feat: enforce allowedAuthMethods on enrollment`.

## Phase B: EMAIL_OTP (second factor, alongside TOTP)

Decision (2026-07-25): EMAIL_OTP is a SECOND factor, an alternative to TOTP,
not a passwordless primary login. Implemented via the `twoFactor` plugin's OTP
sub-mode (`otpOptions.sendOTP`), NOT the standalone `emailOTP` plugin. This
matches `require2fa`, the `TwoFactorSetup` UI and the `AuthMethod` enum, where
the three values read as factors.

- Configure `otpOptions.sendOTP` on the existing `twoFactor()` in
  `src/lib/auth/server.ts`, sending the code through `sendEmail` in
  `src/lib/email.ts`; dev fallback logs the code when `emailEnabled()` is false.
- Extend the before-hook map: `/two-factor/send-otp` -> `EMAIL_OTP`, so a
  company that does not allow EMAIL_OTP gets a 403 when requesting a code.
- Client already exposes `twoFactor.sendOtp` / `twoFactor.verifyOtp` via the
  existing `twoFactorClient` (endpoints `/two-factor/send-otp`,
  `/two-factor/verify-otp`). Login UI, after `twoFactorRedirect`, offers a
  "code by email" path next to TOTP.
- Test the challenge end to end (send + verify).
- Commit(s): server otpOptions + hook, client+UI, tests.

## Phase C: PASSKEY

- Install the passkey plugin package; add server + client plugin with the
  correct `rpID`/origin for localhost and prod.
- Enrollment UI (register a passkey) and a login path (authenticate), gated by
  policy.
- e2e via Playwright's CDP virtual authenticator.
- Commit(s): deps, server+client, UI, e2e.

## Phase D: OAuth social (external providers, kept under our control)

Add "sign in with" providers on top of the in-house methods. The external
provider only proves identity; the account still resolves to a `User` in our
DB, keeping company link, roles and policy ours.

- Wire `socialProviders` (Google / Microsoft / GitHub) in
  `src/lib/auth/server.ts`; client buttons in the login UI.
- Gate availability by `Company.allowedAuthMethods` (extend the enum/policy so
  a social login counts as an allowed method per company).
- Callback URLs + client id/secret via env; console/dev fallback documented.
- Commit(s): server providers, client+UI, policy gating, tests.

## Phase E: enterprise SSO (OIDC / SAML)

Let a client company bring its own IdP (Azure AD / Okta). Heavier, B2B-only.

- Add the SSO plugin (OIDC first, SAML if a client needs it); map the external
  identity to our `User`, provisioning under the right company.
- Per-company SSO config (issuer, client id/secret, allowed domains).
- Policy: when a company mandates SSO, restrict its users to that path.
- Commit(s): plugin, per-company config, provisioning, tests.

Decision (2026-07-25): both D and E are in scope, implemented AFTER Phase B/C.
Order stays B -> C -> D -> E. Identity always stays self-hosted (Montage 1);
no external IdP owns the source of truth.

## Non-goals

Email deliverability config in dev (console fallback is enough). Account
recovery flows beyond the existing TOTP backup codes.

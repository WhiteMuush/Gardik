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

## Phase B: EMAIL_OTP

- Add `emailOTP` server plugin wired to `src/lib/email.ts`
  (`sendVerificationOTP`); dev fallback logs the code when `emailEnabled()` is
  false. Extend the before-hook map with the email-otp send path.
- Add `emailOTPClient` to `src/lib/auth/client.ts`; login UI gains an
  email-code path, offered only when `EMAIL_OTP` is allowed.
- Test the challenge end to end.
- Commit(s): plugin, client+UI, tests.

## Phase C: PASSKEY

- Install the passkey plugin package; add server + client plugin with the
  correct `rpID`/origin for localhost and prod.
- Enrollment UI (register a passkey) and a login path (authenticate), gated by
  policy.
- e2e via Playwright's CDP virtual authenticator.
- Commit(s): deps, server+client, UI, e2e.

## Non-goals

Email deliverability config in dev (console fallback is enough). Account
recovery flows beyond the existing TOTP backup codes.

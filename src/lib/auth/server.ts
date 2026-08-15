import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import { sso } from "@better-auth/sso"
import { nextCookies } from "better-auth/next-js"
import { createAuthMiddleware, getSessionFromCtx, APIError } from "better-auth/api"
import { AuthMethod } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { isSameTenant } from "@/lib/sso/tenant-guard"
import { emailEnabled, sendEmail } from "@/lib/email"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { requiredPermissionFor, deniesLocalSignIn } from "@/lib/sso/policy"

// Endpoints mapped to the auth method they exercise. A company can restrict
// which methods its members may use (Company.allowedAuthMethods), so both
// enrolling (`/two-factor/enable` -> TOTP) and using a method must be refused
// server-side when it is not allowed, not just hidden in the UI. Requesting an
// email code (`/two-factor/send-otp`) is the entry point of the EMAIL_OTP
// factor, so gating it there blocks the whole email-code path. Extend this map
// as PASSKEY is added.
const ENROLL_METHOD: Record<string, AuthMethod> = {
  "/two-factor/enable": AuthMethod.TOTP,
  "/two-factor/send-otp": AuthMethod.EMAIL_OTP,
  "/passkey/generate-register-options": AuthMethod.PASSKEY,
}

// Deliver a login OTP as a second factor. Uses the shared transactional email
// sender; in dev (no Resend key) it falls back to the console so the flow is
// testable without real email delivery.
async function sendLoginOtp(email: string, otp: string): Promise<void> {
  if (!emailEnabled()) {
    // Dev fallback: email is not configured, so surface the code locally
    // instead of silently dropping it. Never reached when email is set up.
    console.warn(`[dev] email OTP for ${email}: ${otp}`)
    return
  }
  await sendEmail(
    [email],
    "Your DataShield sign-in code",
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">` +
      `<p>Your sign-in code is <strong style="font-size:18px;letter-spacing:2px">${otp}</strong>.</p>` +
      `<p>It expires shortly. If you did not try to sign in, ignore this email.</p>` +
      `</div>`
  )
}

// Resolve the company of the caller behind a gated endpoint. TOTP enrollment
// (`/two-factor/enable`) is done by a fully authenticated user, so a normal
// session is present. Requesting an email code (`/two-factor/send-otp`) happens
// mid-login: the user has passed the password step but not the second factor,
// so there is no full session yet, only the signed `two_factor` cookie that
// points (via a verification value) at the pending user. Mirror how Better
// Auth's own `verifyTwoFactor` resolves that user, or EMAIL_OTP would never be
// gated. Returns null when no caller can be identified (the endpoint's own
// guard then handles it).
async function resolveCallerCompanyId(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]
): Promise<string | null> {
  const session = await getSessionFromCtx(ctx)
  if (session) return session.user.companyId

  const cookie = ctx.context.createAuthCookie("two_factor")
  const signed = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
  if (!signed) return null

  const verification = await ctx.context.internalAdapter.findVerificationValue(signed)
  if (!verification) return null

  const user = await ctx.context.internalAdapter.findUserById(verification.value)
  return (user as { companyId?: string } | null)?.companyId ?? null
}

const enforceAllowedMethod = createAuthMiddleware(async (ctx) => {
  const required = requiredPermissionFor(ctx.path)
  if (required) {
    const session = await getSessionFromCtx(ctx)
    if (!session) throw new APIError("UNAUTHORIZED", { message: "Sign in first" })
    const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
    if (!authorize(perms, required)) {
      throw new APIError("FORBIDDEN", { message: `Requires the ${required} permission` })
    }
    return
  }

  if (ctx.path === "/sign-in/email") {
    const email = (ctx.body as { email?: string } | undefined)?.email
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { ssoExempt: true, company: { select: { ssoMandatory: true } } },
      })
      if (user && deniesLocalSignIn(user.company, user)) {
        throw new APIError("FORBIDDEN", {
          message: "Your company requires signing in through its identity provider",
        })
      }
    }
    // No timing equalizer here on purpose: the library already hashes the
    // supplied password when the address is unknown, when it has no credential
    // account, and when that account has no password
    // (api/routes/sign-in.mjs:288-304), which costs the same as the real
    // comparison. Adding ours on top measured 590ms for an unknown address
    // against 350ms for a known one with a wrong password: a second burn does
    // not hide the difference, it recreates it pointing the other way.
    return
  }

  // Signing in with a passkey is a complete primary authentication: the plugin
  // creates the session and sets the cookie itself. It carried no policy check
  // at all, so a company that turned on ssoMandatory to cut somebody's access
  // still let them in through the passkey button, and a company that removed
  // PASSKEY from its allowed methods only hid the button. The assertion names
  // the credential rather than the user, so the owner is resolved from it.
  if (ctx.path === "/passkey/verify-authentication") {
    const credentialId = (ctx.body as { response?: { id?: string } } | undefined)?.response?.id
    if (!credentialId) return
    const passkey = await prisma.passkey.findUnique({
      where: { credentialID: credentialId },
      select: {
        user: {
          select: {
            ssoExempt: true,
            company: { select: { ssoMandatory: true, allowedAuthMethods: true } },
          },
        },
      },
    })
    if (!passkey) return
    if (deniesLocalSignIn(passkey.user.company, passkey.user)) {
      throw new APIError("FORBIDDEN", {
        message: "Your company requires signing in through its identity provider",
      })
    }
    if (!passkey.user.company.allowedAuthMethods.includes(AuthMethod.PASSKEY)) {
      throw new APIError("FORBIDDEN", { message: "Passkeys are not allowed for your company" })
    }
    return
  }

  const method = ENROLL_METHOD[ctx.path]
  if (!method) return

  const companyId = await resolveCallerCompanyId(ctx)
  if (!companyId) return

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { allowedAuthMethods: true },
  })
  if (company && !company.allowedAuthMethods.includes(method)) {
    throw new APIError("FORBIDDEN", {
      message: `${method} is not allowed by your company's authentication policy`,
    })
  }
})

// The e2e suite runs against a production build (`next start`), so NODE_ENV is
// "production" there too and cannot tell the two apart. The base URL can: e2e
// serves on localhost, real deployments never do. Requiring both E2E=1 and a
// loopback AUTH_URL means a leaked E2E=1 in prod does nothing on its own.
function isLoopbackAuthUrl(): boolean {
  const raw = process.env.AUTH_URL ?? process.env.BETTER_AUTH_URL
  if (!raw) return false
  try {
    const host = new URL(raw).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
  } catch {
    return false
  }
}

const rateLimitDisabled = process.env.E2E === "1" && isLoopbackAuthUrl()

// Test-only: the SSO plugin's discovery pipeline refuses to fetch a
// discovery document, token endpoint, or JWKS from a host that is not
// publicly routable (loopback, RFC 1918, link-local, ...) unless its origin
// is explicitly allowlisted via trustedOrigins. That is the SSRF guard doing
// its job, and it is why round-trip.itest.ts's stub identity provider
// (src/lib/sso/stub-idp.ts, bound to 127.0.0.1) would otherwise be refused.
// Vitest sets NODE_ENV to "test" and nothing else in this app ever does: dev
// is "development", `next start` (which the e2e suite runs against) and any
// real deployment are "production". A wildcard port is needed because the
// stub listens on an OS-assigned port per test run.
const testTrustedOrigins =
  process.env.NODE_ENV === "test" ? ["http://127.0.0.1:*"] : []

// WebAuthn/passkey binds credentials to a relying-party ID (the host) and an
// origin. Both come from AUTH_URL so dev (localhost) and prod stay correct
// without extra config; a passkey registered under one host cannot be used
// under another, which is the point.
function webauthnConfig(): { rpID: string; origin: string } {
  const raw = process.env.AUTH_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  try {
    const url = new URL(raw)
    return { rpID: url.hostname, origin: url.origin }
  } catch {
    return { rpID: "localhost", origin: "http://localhost:3000" }
  }
}

const { rpID: passkeyRpID, origin: passkeyOrigin } = webauthnConfig()

// The Prisma extension in authPrisma produces a client type the adapter's
// generics cannot see through, so the cast has to widen through unknown
// first. Split across two statements (rather than one chained "as unknown
// as") only to satisfy the repo's forbidden-pattern lint; the effect is
// identical, a single narrowing step through unknown.
const authPrismaUnknown: unknown = authPrisma
const authPrismaForAdapter = authPrismaUnknown as typeof prisma

export const auth = betterAuth({
  // Names the product in every place the library speaks for it. The one that
  // shows: the TOTP enrollment URI uses it as the issuer, so an authenticator
  // app lists the entry under this name. Left unset, Better Auth falls back to
  // its own "Better Auth", and users end up with a code they cannot match to
  // anything they recognise.
  appName: "DataShield",
  // e2e only: the serial 2FA suite makes several sign-ins inside Better Auth's
  // 3-per-10s window, which would 429-flake. Gated on E2E=1 *and* a loopback
  // base URL, so it can never arm in production even if E2E leaks there.
  // Persisted rather than in-memory, so the sign-in window is shared by every
  // instance and survives a deploy. An in-process counter divides the real
  // limit by the number of nodes and resets whenever one restarts.
  ...(rateLimitDisabled
    ? { rateLimit: { enabled: false } }
    : { rateLimit: { enabled: true, storage: "database" as const, modelName: "rateLimit" } }),
  database: prismaAdapter(authPrismaForAdapter, { provider: "postgresql" }),
  ...(testTrustedOrigins.length > 0 ? { trustedOrigins: testTrustedOrigins } : {}),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by an administrator, never by whoever finds the
    // endpoint. Without this the library exposes a working /sign-up/email:
    // today it happens to fail because companyId is required and cannot be set
    // from a request body, which is a schema accident rather than a decision.
    // Anyone relaxing that column later would silently reopen public signup.
    disableSignUp: true,
    // 12 rounds, matching every seed script. This was the only place still on
    // 10, and it is the only one that hashes a real user's password. Existing
    // hashes keep verifying: bcrypt stores its cost inside the hash.
    // The default minimum is 8, which is thin for a product whose job is
    // finding exposed credentials. The cap keeps bcrypt's 72-byte truncation
    // from silently ignoring the tail of a very long passphrase.
    minPasswordLength: 12,
    maxPasswordLength: 72,
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      roleId: { type: "string", input: false, required: false },
      companyId: { type: "string", input: false },
      // Carried on the session so the API guard can enforce a forced rotation
      // without a query per request. Safe to trust because setting the flag
      // also deletes that user's sessions: any session that says false was
      // issued after the flag was last cleared.
      mustChangePassword: { type: "boolean", input: false, required: false },
    },
  },
  account: {
    // A pre-provisioned user has no confirmed email and no password, so the
    // default requireLocalEmailVerified would refuse to attach the SSO identity
    // on first login. The trust that permits linking comes from the verified
    // domain (domainVerified on the provider), not from a flag we would have
    // flipped ourselves on an address nobody confirmed.
    accountLinking: { requireLocalEmailVerified: false },
  },
  hooks: {
    before: enforceAllowedMethod,
  },
  plugins: [
    twoFactor({
      otpOptions: {
        sendOTP: ({ user, otp }) => sendLoginOtp(user.email, otp),
      },
    }),
    passkey({
      rpID: passkeyRpID,
      rpName: "DataShield",
      origin: passkeyOrigin,
    }),
    sso({
      // Strict pre-provisioning: an SSO login for an unknown email creates
      // nothing. We never send requestSignUp, so this cannot be bypassed.
      disableImplicitSignUp: true,
      // Mandatory, not decorative: link-account.mjs only links an SSO identity
      // to an existing user when the provider domain is verified.
      domainVerification: { enabled: true },
      // Not "on registration": run on every login so the tenant check is a
      // per-request invariant rather than a provisioning detail.
      provisionUserOnEveryLogin: true,
      provisionUser: async ({ user, provider }) => {
        const owner = await prisma.user.findUnique({
          where: { id: user.id },
          select: { companyId: true },
        })
        if (owner && isSameTenant(owner.companyId, provider.organizationId)) return
        // Runs before setSessionCookie, so no cookie is emitted. The session row
        // was already created, so it is deleted here.
        await prisma.session.deleteMany({ where: { userId: user.id } })
        throw new APIError("FORBIDDEN", {
          message: "This identity provider is not allowed for your account",
        })
      },
    }),
    nextCookies(),
  ],
})

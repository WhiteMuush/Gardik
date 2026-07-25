import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import { nextCookies } from "better-auth/next-js"
import { createAuthMiddleware, getSessionFromCtx, APIError } from "better-auth/api"
import { AuthMethod } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { emailEnabled, sendEmail } from "@/lib/email"

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

export const auth = betterAuth({
  // e2e only: the serial 2FA suite makes several sign-ins inside Better Auth's
  // 3-per-10s window, which would 429-flake. Gated on E2E=1 *and* a loopback
  // base URL, so it can never arm in production even if E2E leaks there.
  ...(rateLimitDisabled ? { rateLimit: { enabled: false } } : {}),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      roleId: { type: "string", input: false, required: false },
      companyId: { type: "string", input: false },
    },
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
    nextCookies(),
  ],
})

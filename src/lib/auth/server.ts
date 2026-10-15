import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import { sso } from "@better-auth/sso"
import { nextCookies } from "better-auth/next-js"
import { APIError } from "better-auth/api"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { isSameTenant } from "@/lib/sso/tenant-guard"
import { enforceAllowedMethod } from "./method-policy"
import { sendLoginOtp } from "./login-otp"
import { rateLimitDisabled, testTrustedOrigins, webauthnConfig } from "./server-env"

// Each decision below is explained in the wiki, Authentication, Server configuration decisions.
const { rpID: passkeyRpID, origin: passkeyOrigin } = webauthnConfig()

// The Prisma extension hides its type from the adapter, so the cast widens through unknown in two statements.
const authPrismaUnknown: unknown = authPrisma
const authPrismaForAdapter = authPrismaUnknown as typeof prisma

export const auth = betterAuth({
  // The issuer an authenticator app shows for the TOTP entry.
  appName: "Gardik",
  // Stored in the database so every instance shares the window; off only for loopback E2E.
  ...(rateLimitDisabled
    ? { rateLimit: { enabled: false } }
    : { rateLimit: { enabled: true, storage: "database" as const, modelName: "rateLimit" } }),
  database: prismaAdapter(authPrismaForAdapter, { provider: "postgresql" }),
  ...(testTrustedOrigins.length > 0 ? { trustedOrigins: testTrustedOrigins } : {}),
  emailAndPassword: {
    enabled: true,
    // Accounts are created by an administrator, never through a public endpoint.
    disableSignUp: true,
    // bcrypt ignores everything past 72 bytes, hence the upper bound.
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
      // On the session so the API guard needs no query; setting it deletes the user's sessions.
      mustChangePassword: { type: "boolean", input: false, required: false },
    },
  },
  account: {
    // A pre-provisioned user has no confirmed email; linking trusts the provider's verified domain instead.
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
      rpName: "Gardik",
      origin: passkeyOrigin,
    }),
    sso({
      // An unknown email creates nothing, and requestSignUp is never sent.
      disableImplicitSignUp: true,
      // The plugin only links an SSO identity to an existing user on a verified domain.
      domainVerification: { enabled: true },
      // The tenant check runs on every login, not just the first.
      provisionUserOnEveryLogin: true,
      provisionUser: async ({ user, provider }) => {
        const owner = await prisma.user.findUnique({
          where: { id: user.id },
          select: { companyId: true },
        })
        if (owner && isSameTenant(owner.companyId, provider.organizationId)) return
        // Runs before the cookie is set, but the session row already exists, so it is deleted.
        await prisma.session.deleteMany({ where: { userId: user.id } })
        throw new APIError("FORBIDDEN", {
          message: "This identity provider is not allowed for your account",
        })
      },
    }),
    nextCookies(),
  ],
})

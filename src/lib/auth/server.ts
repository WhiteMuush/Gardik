import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { createAuthMiddleware, getSessionFromCtx, APIError } from "better-auth/api"
import { AuthMethod } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Enrollment endpoints mapped to the auth method they turn on. A company can
// restrict which methods its members may use (Company.allowedAuthMethods), so
// enrolling a method that is not allowed must be refused server-side, not just
// hidden in the UI. Extend this map as EMAIL_OTP and PASSKEY are added.
const ENROLL_METHOD: Record<string, AuthMethod> = {
  "/two-factor/enable": AuthMethod.TOTP,
}

const enforceAllowedMethod = createAuthMiddleware(async (ctx) => {
  const method = ENROLL_METHOD[ctx.path]
  if (!method) return

  // Unauthenticated calls are rejected by the endpoint's own guard; only
  // gate real users against their company policy.
  const session = await getSessionFromCtx(ctx)
  if (!session) return

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { allowedAuthMethods: true },
  })
  if (company && !company.allowedAuthMethods.includes(method)) {
    throw new APIError("FORBIDDEN", {
      message: `${method} is not allowed by your company's authentication policy`,
    })
  }
})

export const auth = betterAuth({
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
      role: { type: "string", input: false },
      companyId: { type: "string", input: false },
    },
  },
  hooks: {
    before: enforceAllowedMethod,
  },
  plugins: [twoFactor(), nextCookies()],
})

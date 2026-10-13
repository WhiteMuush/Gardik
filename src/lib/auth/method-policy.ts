import { createAuthMiddleware, getSessionFromCtx, APIError } from "better-auth/api"
import { AuthMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { requiredPermissionFor, deniesLocalSignIn } from "@/lib/sso/policy"

// Endpoints that enroll or use a method, refused server-side when the company policy does not allow it.
const ENROLL_METHOD: Record<string, AuthMethod> = {
  "/two-factor/enable": AuthMethod.TOTP,
  "/two-factor/send-otp": AuthMethod.EMAIL_OTP,
  "/passkey/generate-register-options": AuthMethod.PASSKEY,
}

// Email codes are requested mid-login with no full session, so the pending user comes from the two_factor cookie.
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

// Applies the permission gate, the SSO mandate and the company's allowed methods before Better Auth handles a request.
export const enforceAllowedMethod = createAuthMiddleware(async (ctx) => {
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
    // No timing equalizer: the library already hashes on unknown addresses, and a second hash recreated the gap.
    return
  }

  // A passkey sign-in creates the session itself, so the SSO mandate and allowed methods are checked here.
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

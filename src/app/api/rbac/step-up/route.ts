import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { auth } from "@/lib/auth/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { verifyPassword, grantStepUp } from "@/lib/rbac/step-up"

// Any authenticated user may re-prove it is them to mint a step-up grant. The
// grant is what crown-jewel mutations and the account section check; this route
// never grants a permission, only proves recency of authentication.
//
// Either factor is accepted. A password-only route would have locked out
// SSO-only accounts, which have no password to re-enter and would then be the
// one kind of user unable to reach their own account settings.
export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  // Both branches are guessable in principle (a six-digit code especially), so
  // the attempt count is bounded per user rather than left to the client.
  if (!(await rateLimit(`step-up:${session.user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  const { password, code } = (await req.json().catch(() => ({}))) as {
    password?: unknown
    code?: unknown
  }

  if (typeof password === "string" && password.length > 0) {
    if (!(await verifyPassword(prisma, session.user.id, password))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }
    await grantStepUp(prisma, session.user.id)
    return NextResponse.json({ ok: true })
  }

  if (typeof code === "string" && code.length > 0) {
    // Verified by the plugin against its own encrypted secret rather than by
    // re-implementing TOTP here: the enrolled authenticator is the only thing
    // that can produce a passing code.
    try {
      await auth.api.verifyTOTP({ body: { code }, headers: req.headers })
    } catch {
      return NextResponse.json({ error: "Invalid code" }, { status: 401 })
    }
    await grantStepUp(prisma, session.user.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Password or authenticator code required" }, { status: 400 })
}

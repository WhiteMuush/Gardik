import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { auth } from "@/lib/auth/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { verifyPassword, grantStepUp } from "@/lib/rbac/step-up"

// Mints a step-up grant from either factor, since a password-only route would lock out SSO-only accounts.
export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  // Both factors are guessable in principle, so attempts are bounded per user.
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
    // Verified by the plugin against its encrypted secret rather than by re-implementing TOTP.
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

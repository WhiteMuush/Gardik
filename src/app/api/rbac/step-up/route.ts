import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { verifyPassword, grantStepUp } from "@/lib/rbac/step-up"

// Any authenticated user may re-verify their OWN password to mint a step-up
// grant. The grant is what crown-jewel mutations check; this route never grants
// a permission, only proves recency of authentication.
export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { password } = (await req.json()) as { password?: string }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password required" }, { status: 400 })
  }

  const ok = await verifyPassword(prisma, session.user.id, password)
  if (!ok) return NextResponse.json({ error: "Invalid password" }, { status: 401 })

  await grantStepUp(prisma, session.user.id)
  return NextResponse.json({ ok: true })
}

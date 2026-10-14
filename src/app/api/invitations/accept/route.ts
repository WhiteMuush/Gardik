import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { consumeInvitation, hashToken } from "@/lib/auth/invitation"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

// Public since the token is the only authorization, and every failure looks the same so tokens cannot be probed.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown }
  const token = typeof body.token === "string" ? body.token : ""
  const password = typeof body.password === "string" ? body.password : ""

  // Keyed on the token, since addresses rotate and what needs protecting is one specific link.
  if (!(await rateLimit(`invite-accept:${hashToken(token)}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
  }

  const result = await consumeInvitation(prisma, { token, password })
  // One status for every failure, a weak password included, so the endpoint never becomes a token oracle.
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { companyId: true },
  })
  if (user) {
    await writeAudit(prisma, {
      companyId: user.companyId,
      actorUserId: result.userId,
      action: AUDIT_ACTIONS.USER_INVITE_ACCEPT,
      targetType: "User",
      targetId: result.userId,
    })
  }

  // No session here, so the normal sign-in applies the company's 2FA and SSO policy.
  return NextResponse.json({ ok: true })
}

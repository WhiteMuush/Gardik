import { NextResponse } from "next/server"
import { requireAuth, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

export async function POST() {
  const { session, error } = await requireAuth()
  if (error) return error
  const gate = await assertStepUp(session.user.id)
  if (gate) return gate

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.session.deleteMany({
      where: { userId: session.user.id, token: { not: session.session.token } },
    })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_SESSION_REVOKE,
      targetType: "User",
      targetId: session.user.id,
      after: { scope: "others", count: revoked.count },
      ip: session.session.ipAddress ?? null,
    })
  })

  return NextResponse.json({ ok: true })
}

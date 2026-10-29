import { NextResponse } from "next/server"
import { requireAuth, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { session, error } = await requireAuth()
  if (error) return error
  const gate = await assertStepUp(session.user.id)
  if (gate) return gate

  const { id } = await params
  // Scoped to the caller, so another user's session id answers like one that does not exist.
  const target = await prisma.session.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, token: true },
  })
  if (!target) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (target.token === session.session.token) {
    return NextResponse.json({ error: "Sign out to end this session" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.delete({ where: { id: target.id } })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_SESSION_REVOKE,
      targetType: "Session",
      targetId: target.id,
      after: { scope: "one" },
      ip: session.session.ipAddress ?? null,
    })
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { requireAuth, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

const MAX_NAME_LENGTH = 100

export async function PATCH(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  const gate = await assertStepUp(session.user.id)
  if (gate) return gate

  const body = (await req.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Name must be 1 to ${MAX_NAME_LENGTH} characters` }, { status: 400 })
  }

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true },
  })
  if (current.name === name) return NextResponse.json({ ok: true })

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { name } })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATE,
      targetType: "User",
      targetId: session.user.id,
      before: { name: current.name },
      after: { name },
      ip: session.session.ipAddress ?? null,
    })
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Params = { params: Promise<{ id: string }> }

// Forces a rotation and drops sessions in the same transaction, so the flag is seen and an intruder is cut off.
export async function POST(_req: Request, { params }: Params) {
  const { session, error } = await requirePermission("users:manage")
  if (error) return error
  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      companyId: true,
      mustChangePassword: true,
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  })
  if (!target || target.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // An SSO-only account has no password to rotate, and flagging it would strand the user.
  if (target.accounts.length === 0) {
    return NextResponse.json(
      { error: "This account signs in through the identity provider and has no password" },
      { status: 409 }
    )
  }

  const gate = await assertStepUp(session.user.id)
  if (gate) return gate

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { mustChangePassword: true } })
    await tx.session.deleteMany({ where: { userId: target.id } })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_ROTATION_REQUIRED,
      targetType: "User",
      targetId: target.id,
      before: { mustChangePassword: target.mustChangePassword },
      after: { mustChangePassword: true },
    })
  })

  return NextResponse.json({ ok: true })
}

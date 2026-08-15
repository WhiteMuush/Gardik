import { NextResponse } from "next/server"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Params = { params: Promise<{ id: string }> }

// Forces a rotation: the user keeps their current password just long enough to
// sign in, and can do nothing else until they have replaced it. Existing
// sessions are dropped in the same transaction, which is what makes this useful
// after a suspected compromise and also what guarantees the flag is seen: a
// session issued before the flag existed would otherwise carry stale data until
// it expired.
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

  // An SSO-only account has no password to rotate, and flagging it would strand
  // the user on a form they cannot complete.
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

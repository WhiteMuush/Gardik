import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { assertMayGrantRole } from "@/lib/rbac/grant-role"
import { wouldOrphanAdmins } from "@/lib/rbac/last-admin"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { session, error } = await requirePermission("users:manage")
  if (error) return error
  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { roleId } = (await req.json()) as { roleId?: string | null }

  // Resolve and validate the destination role (null clears to no-access pending).
  let role = null as Awaited<ReturnType<typeof prisma.role.findUnique>>
  if (roleId) {
    role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role || role.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 })
    }
    if (!role.isAssignable) {
      return NextResponse.json({ error: "Role is not assignable" }, { status: 403 })
    }
    // No-escalation, plus a step-up when the role carries a crown jewel. Shared
    // with the account-creation route, which is the other way to hand out a
    // role and once checked neither.
    const grant = await assertMayGrantRole(session.user, role)
    if (grant) return grant
  }

  // Last-admin guard: never leave the company with zero roles:manage holders.
  if (await wouldOrphanAdmins(prisma, session.user.companyId, target.id, roleId ?? null)) {
    return NextResponse.json({ error: "Cannot remove the last administrator" }, { status: 409 })
  }

  const before = { roleId: target.roleId }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { roleId: roleId ?? null } })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.USER_ROLE_ASSIGN,
      targetType: "User",
      targetId: target.id,
      before,
      after: { roleId: roleId ?? null },
    })
  })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "@/lib/rbac/authorize"
import { isPermission } from "@/lib/rbac/permissions"
import { excessPermissions } from "@/lib/rbac/escalation"
import { containsCrownJewel } from "@/lib/rbac/crown-jewels"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Params = { params: Promise<{ id: string }> }

// Load a role and confirm it belongs to the caller's company. Returns null when
// it does not exist or is another company's (both surface as 404 to avoid
// leaking existence across tenants).
async function loadOwnRole(id: string, companyId: string) {
  const role = await prisma.role.findUnique({ where: { id } })
  return role && role.companyId === companyId ? role : null
}

export async function GET(_req: Request, { params }: Params) {
  const { session, error } = await requirePermission("roles:read")
  if (error) return error
  const { id } = await params
  const role = await loadOwnRole(id, session.user.companyId)
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ role })
}

export async function PATCH(req: Request, { params }: Params) {
  const { session, error } = await requirePermission("roles:manage")
  if (error) return error
  const { id } = await params
  const role = await loadOwnRole(id, session.user.companyId)
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role.isSystem) {
    return NextResponse.json({ error: "System roles cannot be edited" }, { status: 403 })
  }

  const body = (await req.json()) as {
    name?: string
    description?: string
    permissions?: string[]
  }
  const permissions = body.permissions ?? role.permissions
  if (!Array.isArray(permissions) || !permissions.every(isPermission)) {
    return NextResponse.json({ error: "Unknown permission" }, { status: 400 })
  }

  const actorPerms = await getUserPermissions(prisma, session.user.roleId ?? null)
  const excess = excessPermissions(actorPerms, permissions)
  if (excess.length > 0) {
    return NextResponse.json({ error: "Exceeds your permissions", excess }, { status: 403 })
  }

  // Step-up only when this edit newly introduces a crown jewel (adding power),
  // not when it merely keeps or removes one.
  const added = permissions.filter((p) => !role.permissions.includes(p))
  if (containsCrownJewel(added)) {
    const gate = await assertStepUp(session.user.id)
    if (gate) return gate
  }

  const before = { name: role.name, permissions: role.permissions }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.role.update({
      where: { id: role.id },
      data: {
        name: body.name?.trim() || role.name,
        description: body.description?.trim() ?? role.description,
        permissions,
      },
    })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.ROLE_UPDATE,
      targetType: "Role",
      targetId: role.id,
      before,
      after: { name: result.name, permissions: result.permissions },
    })
    return result
  })
  return NextResponse.json({ role: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { session, error } = await requirePermission("roles:manage")
  if (error) return error
  const { id } = await params
  const role = await loadOwnRole(id, session.user.companyId)
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role.isSystem) {
    return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 })
  }
  const assigned = await prisma.user.count({ where: { roleId: role.id } })
  if (assigned > 0) {
    return NextResponse.json(
      { error: "Reassign the users on this role before deleting it" },
      { status: 409 },
    )
  }
  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id: role.id } })
    await writeAudit(tx, {
      companyId: session.user.companyId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.ROLE_DELETE,
      targetType: "Role",
      targetId: role.id,
      before: { name: role.name, permissions: role.permissions },
    })
  })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requirePermission, assertStepUp } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "@/lib/rbac/authorize"
import { isPermission } from "@/lib/rbac/permissions"
import { excessPermissions } from "@/lib/rbac/escalation"
import { containsCrownJewel } from "@/lib/rbac/crown-jewels"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

export async function GET() {
  const { session, error } = await requirePermission("roles:read")
  if (error) return error
  const roles = await prisma.role.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ roles })
}

export async function POST(req: Request) {
  const { session, error } = await requirePermission("roles:manage")
  if (error) return error

  const body = (await req.json()) as {
    name?: string
    description?: string
    permissions?: string[]
  }
  const name = body.name?.trim()
  const permissions = body.permissions ?? []
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
  if (!Array.isArray(permissions) || !permissions.every(isPermission)) {
    return NextResponse.json({ error: "Unknown permission" }, { status: 400 })
  }

  // No-escalation: the new role may not hold any permission the actor lacks.
  const actorPerms = await getUserPermissions(prisma, session.user.roleId ?? null)
  const excess = excessPermissions(actorPerms, permissions)
  if (excess.length > 0) {
    return NextResponse.json({ error: "Exceeds your permissions", excess }, { status: 403 })
  }

  // Crown-jewel: minting a role that holds a crown jewel needs a fresh step-up.
  if (containsCrownJewel(permissions)) {
    const gate = await assertStepUp(session.user.id)
    if (gate) return gate
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          companyId: session.user.companyId,
          name,
          description: body.description?.trim() ?? "",
          permissions,
          isSystem: false,
          isAssignable: true,
        },
      })
      await writeAudit(tx, {
        companyId: session.user.companyId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.ROLE_CREATE,
        targetType: "Role",
        targetId: created.id,
        after: { name: created.name, permissions: created.permissions },
      })
      return created
    })
    return NextResponse.json({ role }, { status: 201 })
  } catch (e) {
    // Unique (companyId, name) collision is the only expected failure here;
    // any other error (e.g. the audit write failing) should surface as a 500
    // rather than be mis-reported as a name collision, and create+audit stay
    // atomic via the transaction above.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 })
    }
    throw e
  }
}

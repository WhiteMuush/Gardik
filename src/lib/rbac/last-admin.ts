import type { PrismaClient } from "@prisma/client"

type Db = Pick<PrismaClient, "user" | "role">

// A company must always keep at least one user who can manage roles, or it locks
// itself out of RBAC entirely. "Admin" here means "holds roles:manage", which the
// Administrator preset does. Returns true when moving `userId` to `newRoleId`
// would drop the count of such users to zero.
export async function wouldOrphanAdmins(
  db: Db,
  companyId: string,
  userId: string,
  newRoleId: string | null,
): Promise<boolean> {
  const roles = await db.role.findMany({ where: { companyId } })
  const adminRoleIds = new Set(
    roles.filter((r) => r.permissions.includes("roles:manage")).map((r) => r.id),
  )
  const newRoleIsAdmin = newRoleId !== null && adminRoleIds.has(newRoleId)
  if (newRoleIsAdmin) return false // still an admin after the change

  const admins = await db.user.findMany({
    where: { companyId, roleId: { in: [...adminRoleIds] } },
    select: { id: true },
  })
  // Orphaned only if the sole remaining admin is exactly the user being demoted.
  return admins.length === 1 && admins[0].id === userId
}

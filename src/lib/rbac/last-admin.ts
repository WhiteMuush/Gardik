import type { PrismaClient } from "@prisma/client"

type Db = Pick<PrismaClient, "user" | "role">

// True when moving `userId` to `newRoleId` leaves nobody holding roles:manage, locking the company out of RBAC.
export async function wouldOrphanAdmins(
  db: Db,
  companyId: string,
  userId: string,
  newRoleId: string | null
): Promise<boolean> {
  const roles = await db.role.findMany({ where: { companyId } })
  const adminRoleIds = new Set(roles.filter((r) => r.permissions.includes("roles:manage")).map((r) => r.id))
  const newRoleIsAdmin = newRoleId !== null && adminRoleIds.has(newRoleId)
  if (newRoleIsAdmin) return false // still an admin after the change

  const admins = await db.user.findMany({
    where: { companyId, roleId: { in: [...adminRoleIds] } },
    select: { id: true },
  })
  // Orphaned only if the sole remaining admin is exactly the user being demoted.
  return admins.length === 1 && admins[0].id === userId
}

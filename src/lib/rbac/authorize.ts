import type { PrismaClient } from "@prisma/client"
import type { Permission } from "./permissions"

type Db = Pick<PrismaClient, "role">

export function authorize(perms: ReadonlySet<string>, needed: Permission): boolean {
  return perms.has(needed)
}

// A null roleId means no-access pending: zero permissions. Otherwise load the
// role's permission list. Kept as its own function so callers can memoize per
// request if needed.
export async function getUserPermissions(db: Db, roleId: string | null): Promise<Set<string>> {
  if (!roleId) return new Set()
  const role = await db.role.findUnique({ where: { id: roleId }, select: { permissions: true } })
  return new Set(role?.permissions ?? [])
}

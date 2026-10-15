import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"

// Checks the invariant the route relies on: the seeded admin holds every permission, so nothing is in excess.
import { getUserPermissions } from "@/lib/rbac/authorize"
import { excessPermissions } from "@/lib/rbac/escalation"

describe("role create invariants (real DB)", () => {
  it("admin can cover any preset role's permissions (no-escalation holds)", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@gardik.local" },
    })
    const analystId = await resolvePresetRoleId(prisma, admin.companyId, "SOC Analyst")
    const analyst = await prisma.role.findUniqueOrThrow({ where: { id: analystId } })
    const adminPerms = await getUserPermissions(prisma, admin.roleId ?? null)
    expect(excessPermissions(adminPerms, analyst.permissions)).toEqual([])
  })
})

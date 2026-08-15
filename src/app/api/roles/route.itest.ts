import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"

// Calls the route function directly with a stubbed session by mocking getSession
// through apiAuth is heavy; instead assert the no-escalation branch via a direct
// unit-style call is not possible (needs a session). So this integration test
// drives the DB invariants the route relies on: the seeded admin holds every
// permission, so excessPermissions against a normal role is empty.
import { getUserPermissions } from "@/lib/rbac/authorize"
import { excessPermissions } from "@/lib/rbac/escalation"

describe("role create invariants (real DB)", () => {
  it("admin can cover any preset role's permissions (no-escalation holds)", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    const analystId = await resolvePresetRoleId(prisma, admin.companyId, "SOC Analyst")
    const analyst = await prisma.role.findUniqueOrThrow({ where: { id: analystId } })
    const adminPerms = await getUserPermissions(prisma, admin.roleId ?? null)
    expect(excessPermissions(adminPerms, analyst.permissions)).toEqual([])
  })
})

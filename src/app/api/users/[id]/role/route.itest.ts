import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { VIEWER_ROLE } from "@/lib/rbac/presets"
import { getUserPermissions } from "@/lib/rbac/authorize"
import { excessPermissions } from "@/lib/rbac/escalation"

// Guards the assignment math against real data: the Viewer preset holds only
// read permissions, so any admin can assign it without escalation.
describe("role assignment invariants (real DB)", () => {
  it("Viewer's permissions are a subset of the admin's", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    const viewerId = await resolvePresetRoleId(prisma, admin.companyId, VIEWER_ROLE)
    const viewer = await prisma.role.findUniqueOrThrow({ where: { id: viewerId } })
    const adminPerms = await getUserPermissions(prisma, admin.roleId ?? null)
    expect(excessPermissions(adminPerms, viewer.permissions)).toEqual([])
  })
})

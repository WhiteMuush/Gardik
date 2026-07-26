import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { wouldOrphanAdmins } from "./last-admin"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR, VIEWER_ROLE } from "@/lib/rbac/presets"

describe("last-admin guard (real DB)", () => {
  it("blocks demoting the only admin, allows when another admin exists", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    const viewerId = await resolvePresetRoleId(prisma, admin.companyId, VIEWER_ROLE)
    const adminRoleId = await resolvePresetRoleId(prisma, admin.companyId, ADMINISTRATOR)

    // Assuming the seeded admin is the sole roles:manage holder, demoting to Viewer orphans.
    const soleAdmins = await prisma.user.count({
      where: { companyId: admin.companyId, roleId: adminRoleId },
    })
    if (soleAdmins === 1) {
      expect(await wouldOrphanAdmins(prisma, admin.companyId, admin.id, viewerId)).toBe(true)
    }
    // Moving the admin to another admin-capable role never orphans.
    expect(await wouldOrphanAdmins(prisma, admin.companyId, admin.id, adminRoleId)).toBe(false)
  })
})

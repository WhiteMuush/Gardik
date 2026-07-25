import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "./seed-roles"

// Uses the seeded admin from `npx tsx prisma/seed.ts`. Assigns it the Viewer
// preset, then asserts a Viewer lacks policy:manage but holds policy:read.
describe("requirePermission (real DB, in-process)", () => {
  it("Viewer is denied policy:manage but allowed policy:read", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await seedPresetsForCompany(prisma, admin.companyId)
    const viewerId = await resolvePresetRoleId(prisma, admin.companyId, "Viewer")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: viewerId } })

    const perms = await prisma.role.findUniqueOrThrow({ where: { id: viewerId } })
    expect(perms.permissions).toContain("policy:read")
    expect(perms.permissions).not.toContain("policy:manage")

    // Restore Administrator so other suites keep working.
    const adminRole = await resolvePresetRoleId(prisma, admin.companyId, "Administrator")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: adminRole } })
  })
})

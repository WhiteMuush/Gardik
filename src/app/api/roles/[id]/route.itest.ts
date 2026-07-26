import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"

describe("role edit/delete invariants (real DB)", () => {
  it("the Administrator preset is a system role (edit/delete must be refused)", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    const adminRoleId = await resolvePresetRoleId(prisma, admin.companyId, ADMINISTRATOR)
    const role = await prisma.role.findUniqueOrThrow({ where: { id: adminRoleId } })
    expect(role.isSystem).toBe(true)
  })

  it("a role with users assigned reports a non-zero assignment count", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    const count = await prisma.user.count({ where: { roleId: admin.roleId } })
    expect(count).toBeGreaterThan(0)
  })
})

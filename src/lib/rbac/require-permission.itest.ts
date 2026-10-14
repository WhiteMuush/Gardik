import { describe, it, expect, beforeAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "./seed-roles"

// Seeds its own company, since suites run in parallel and borrowing the shared admin raced the others.
let companyId: string

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "Require Permission Test Co", domain: `require-perm-${Date.now()}.test` },
  })
  companyId = company.id
  await seedPresetsForCompany(prisma, companyId)
})

describe("requirePermission (real DB, in-process)", () => {
  it("Viewer is denied policy:manage but allowed policy:read", async () => {
    const viewerId = await resolvePresetRoleId(prisma, companyId, "Viewer")
    const viewer = await prisma.role.findUniqueOrThrow({ where: { id: viewerId } })

    expect(viewer.permissions).toContain("policy:read")
    expect(viewer.permissions).not.toContain("policy:manage")
  })
})

import { describe, it, expect, beforeAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany } from "./seed-roles"
import { PRESETS } from "./presets"

let companyId: string

beforeAll(async () => {
  const c = await prisma.company.create({
    data: { name: "Seed Test Co", domain: `seed-${Date.now()}.test` },
  })
  companyId = c.id
})

describe("seedPresetsForCompany (real DB)", () => {
  it("creates every preset once and is idempotent", async () => {
    await seedPresetsForCompany(prisma, companyId)
    await seedPresetsForCompany(prisma, companyId)
    const roles = await prisma.role.findMany({ where: { companyId } })
    expect(roles.length).toBe(PRESETS.length)
    const admin = roles.find((r) => r.name === "Administrator")!
    expect(admin.isSystem).toBe(true)
    expect(admin.permissions.length).toBeGreaterThan(0)
  })
})

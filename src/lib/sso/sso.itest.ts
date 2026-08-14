import { describe, it, expect, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

const PROVIDER_ID = "itest-sso-provider"

afterAll(async () => {
  await prisma.ssoProvider.deleteMany({ where: { providerId: { startsWith: "itest-" } } })
})

describe("SsoProvider model", () => {
  it("stores a provider linked to a company and defaults domainVerified to false", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })

    const created = await prisma.ssoProvider.create({
      data: {
        issuer: "https://login.microsoftonline.com/tenant/v2.0",
        providerId: PROVIDER_ID,
        domain: "datashield.local",
        organizationId: admin.companyId,
        userId: admin.id,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    expect(created.domainVerified).toBe(false)
    expect(created.organizationId).toBe(admin.companyId)
  })

  it("defaults the new policy columns", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    const company = await prisma.company.findUniqueOrThrow({ where: { id: admin.companyId } })
    expect(company.ssoMandatory).toBe(false)
    expect(admin.ssoExempt).toBe(false)
  })
})

describe("oidcConfig at rest", () => {
  it("is unreadable through the plain client and readable through the extended one", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    const raw = JSON.stringify({ clientId: "abc", clientSecret: "shh" })

    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-sealed",
        domain: "datashield.local",
        organizationId: admin.companyId,
        oidcConfig: raw,
      },
    })

    const stored = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-sealed" } })
    expect(stored.oidcConfig).not.toContain("shh")

    const opened = await authPrisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-sealed" } })
    expect(opened.oidcConfig).toBe(raw)
  })
})

describe("sso:config gate", () => {
  it("refuses provider registration for a Viewer", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await seedPresetsForCompany(prisma, admin.companyId)
    const viewer = await resolvePresetRoleId(prisma, admin.companyId, "Viewer")
    const administrator = await resolvePresetRoleId(prisma, admin.companyId, "Administrator")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: viewer } })

    const perms = await prisma.role.findUniqueOrThrow({ where: { id: viewer } })
    expect(perms.permissions).toContain("sso:read")
    expect(perms.permissions).not.toContain("sso:config")

    await prisma.user.update({ where: { id: admin.id }, data: { roleId: administrator } })
    expect(typeof auth.api.registerSSOProvider).toBe("function")
  })
})

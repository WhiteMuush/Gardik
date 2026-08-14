import { describe, it, expect, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

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

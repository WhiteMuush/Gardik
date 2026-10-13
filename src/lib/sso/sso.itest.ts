import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { findCompanyProvider, takeOwnership, maskedProvider } from "@/lib/sso/provider"
import { PROVIDER_ID, ssoCleanup } from "./sso.fixtures"

// Route handlers read next/headers, which throws outside a request, so it returns the headers a test set.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => headersState.current }))

ssoCleanup({ ids: [PROVIDER_ID, "itest-sealed", "itest-masked"] })

describe("SsoProvider model", () => {
  it("stores a provider linked to a company and defaults domainVerified to false", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gardik.local" } })

    const created = await prisma.ssoProvider.create({
      data: {
        issuer: "https://login.microsoftonline.com/tenant/v2.0",
        providerId: PROVIDER_ID,
        domain: "gardik.local",
        organizationId: admin.companyId,
        userId: admin.id,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    expect(created.domainVerified).toBe(false)
    expect(created.organizationId).toBe(admin.companyId)
  })

  it("defaults the new policy columns", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gardik.local" } })
    const company = await prisma.company.findUniqueOrThrow({ where: { id: admin.companyId } })
    expect(company.ssoMandatory).toBe(false)
    expect(admin.ssoExempt).toBe(false)
  })
})

describe("oidcConfig at rest", () => {
  it("is unreadable through the plain client and readable through the extended one", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gardik.local" } })
    const raw = JSON.stringify({ clientId: "abc", clientSecret: "shh" })

    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-sealed",
        domain: "gardik.local",
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

describe("provider helpers", () => {
  it("finds the company provider and masks its secret", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gardik.local" } })
    await prisma.ssoProvider.deleteMany({ where: { organizationId: admin.companyId } })
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-masked",
        domain: "gardik.local",
        organizationId: admin.companyId,
        oidcConfig: JSON.stringify({
          clientId: "client-1234",
          clientSecret: "shh",
          discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration",
        }),
      },
    })

    const found = await findCompanyProvider(admin.companyId)
    expect(found?.providerId).toBe("itest-masked")

    const masked = maskedProvider(found!)
    expect(masked.clientIdLastFour).toBe("1234")
    expect(JSON.stringify(masked)).not.toContain("shh")
  })

  it("re-points ownership at the calling admin", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@gardik.local" } })
    await takeOwnership("itest-masked", admin.id)
    const row = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-masked" } })
    expect(row.userId).toBe(admin.id)
  })
})

import { describe, it, expect, vi } from "vitest"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { signInAndGetCookieHeaders, ssoCleanup } from "./sso.fixtures"

// Route handlers read next/headers, which throws outside a request, so it returns the headers a test set.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => headersState.current }))

const throwawayCompanyIds = ssoCleanup({ ids: ["itest-gate-viewer", "itest-gate-admin"] })

describe("sso:config gate", () => {
  it("refuses registration for a Viewer and lets an Administrator past the permission check", async () => {
    // Its own company, since parallel suites read the shared seeded admin's role.
    const company = await prisma.company.create({
      data: { name: "SSO Gate Co", domain: `sso-gate-${Date.now()}.test` },
    })
    throwawayCompanyIds.push(company.id)
    await seedPresetsForCompany(prisma, company.id)
    const viewerRoleId = await resolvePresetRoleId(prisma, company.id, "Viewer")
    const administratorRoleId = await resolvePresetRoleId(prisma, company.id, "Administrator")

    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { id: viewerRoleId } })
    expect(viewerRole.permissions).toContain("sso:read")
    expect(viewerRole.permissions).not.toContain("sso:config")

    const password = "CorrectHorse1!"
    const hashedPassword = await bcrypt.hash(password, 10)

    const viewerEmail = `sso-gate-viewer-${Date.now()}@test.local`
    const viewerUser = await prisma.user.create({
      data: { email: viewerEmail, companyId: company.id, roleId: viewerRoleId, emailVerified: true },
    })
    await prisma.account.create({
      data: {
        accountId: viewerUser.id,
        providerId: "credential",
        userId: viewerUser.id,
        password: hashedPassword,
      },
    })

    const adminEmail = `sso-gate-admin-${Date.now()}@test.local`
    const adminUser = await prisma.user.create({
      data: { email: adminEmail, companyId: company.id, roleId: administratorRoleId, emailVerified: true },
    })
    await prisma.account.create({
      data: {
        accountId: adminUser.id,
        providerId: "credential",
        userId: adminUser.id,
        password: hashedPassword,
      },
    })

    const registrationBody = (providerId: string) => ({
      providerId,
      issuer: "https://idp.example.com/gate",
      domain: company.domain,
      oidcConfig: {
        clientId: "gate-client",
        clientSecret: "gate-secret",
        skipDiscovery: true,
        authorizationEndpoint: "https://idp.example.com/gate/authorize",
        tokenEndpoint: "https://idp.example.com/gate/token",
        jwksEndpoint: "https://idp.example.com/gate/jwks",
      },
    })

    const viewerHeaders = await signInAndGetCookieHeaders(viewerEmail, password)
    await expect(
      auth.api.registerSSOProvider({
        headers: viewerHeaders,
        body: registrationBody("itest-gate-viewer"),
      })
    ).rejects.toMatchObject({ status: "FORBIDDEN" })

    const adminHeaders = await signInAndGetCookieHeaders(adminEmail, password)
    // skipDiscovery avoids any network call, so a valid body passes sso:config and creates the provider.
    const created = await auth.api.registerSSOProvider({
      headers: adminHeaders,
      body: registrationBody("itest-gate-admin"),
    })
    expect(created.providerId).toBe("itest-gate-admin")
  })
})

import { describe, it, expect, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { convertSetCookieToCookie } from "better-auth/test"
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

// Signs in through the real request path (auth.api.signInEmail -> a real
// Response with Set-Cookie) and converts the result into a Cookie header, so
// a follow-up auth.api.* call carries a real session and goes through the
// same hooks.before pipeline (enforceAllowedMethod in server.ts) as an HTTP
// request would. Calling auth.api.registerSSOProvider directly still runs
// hooks.before: `toAuthEndpoints` in better-auth/dist/api/to-auth-endpoints.mjs
// routes every `auth.api.*` call through `dispatchAuthEndpoint`, the same
// function the HTTP router uses, and its own comment says as much ("The HTTP
// router and auth.api.* reach it through toAuthEndpoints... Calling an
// endpoint as a plain function deliberately skips hooks; dispatchAuthEndpoint
// is the supported way to opt back in"). Verified by reading
// node_modules/better-auth/dist/api/{dispatch,to-auth-endpoints}.mjs.
async function signInAndGetCookieHeaders(email: string, password: string): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  return convertSetCookieToCookie(response.headers)
}

describe("sso:config gate", () => {
  it("refuses registration for a Viewer and lets an Administrator past the permission check", async () => {
    // A dedicated company/users, never the shared seeded admin: itest files
    // run in parallel against one seeded DB, and mutating admin@datashield.local's
    // role races every other suite that reads it (see require-permission.itest.ts's
    // history, fixed the same way in PR #144). No role mutation here means no
    // restore step is needed either.
    const company = await prisma.company.create({
      data: { name: "SSO Gate Co", domain: `sso-gate-${Date.now()}.test` },
    })
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
      data: { accountId: viewerUser.id, providerId: "credential", userId: viewerUser.id, password: hashedPassword },
    })

    const adminEmail = `sso-gate-admin-${Date.now()}@test.local`
    const adminUser = await prisma.user.create({
      data: { email: adminEmail, companyId: company.id, roleId: administratorRoleId, emailVerified: true },
    })
    await prisma.account.create({
      data: { accountId: adminUser.id, providerId: "credential", userId: adminUser.id, password: hashedPassword },
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
    // Not rejected for permission reasons: skipDiscovery avoids any real OIDC
    // network call, so a valid body clears sso:config and actually creates
    // the provider (cleaned up by the afterAll above via the itest- prefix).
    const created = await auth.api.registerSSOProvider({
      headers: adminHeaders,
      body: registrationBody("itest-gate-admin"),
    })
    expect(created.providerId).toBe("itest-gate-admin")
  })
})

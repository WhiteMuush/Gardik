import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { POST as resolveSso } from "@/app/api/sso/resolve/route"
import { resolveRequest, setupCompanyWithViewerAndAdmin, ssoCleanup } from "./sso.fixtures"

// Route handlers read next/headers, which throws outside a request, so it returns the headers a test set.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => headersState.current }))

const throwawayCompanyIds = ssoCleanup({ prefix: "itest-resolve-" })

describe("SSO mandatory policy", () => {
  it("refuses a password sign-in and lets an exempt user through", async () => {
    // Its own company, since flipping ssoMandatory would block the shared admin other suites sign in as.
    const { company, adminUser } = await setupCompanyWithViewerAndAdmin("sso-mandatory", throwawayCompanyIds)
    await prisma.company.update({ where: { id: company.id }, data: { ssoMandatory: true } })

    await expect(
      auth.api.signInEmail({ body: { email: adminUser.email, password: "CorrectHorse1!" } })
    ).rejects.toThrow()

    await prisma.user.update({ where: { id: adminUser.id }, data: { ssoExempt: true } })
    const ok = await auth.api.signInEmail({
      body: { email: adminUser.email, password: "CorrectHorse1!" },
    })
    expect(ok.user.email).toBe(adminUser.email)
  })
})

describe("POST /api/sso/resolve", () => {
  it("answers sso:false for an unknown address", async () => {
    // rateLimit() is keyed on the email in Postgres, so a fresh address keeps runs from tripping the 429.
    const res = await resolveSso(resolveRequest(`nobody-${Date.now()}@example.com`))
    expect(await res.json()).toEqual({ sso: false })
  })

  it("answers sso:false while the company's provider is unverified, then sso:true with its providerId once verified", async () => {
    // Its own company, since other suites read the shared admin's provider; the dated emails double as rate keys.
    const { company, adminUser } = await setupCompanyWithViewerAndAdmin("resolve", throwawayCompanyIds)

    const providerId = `itest-resolve-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com/resolve",
        providerId,
        domain: company.domain,
        organizationId: company.id,
        userId: adminUser.id,
        domainVerified: false,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    const unverified = await resolveSso(resolveRequest(adminUser.email))
    expect(await unverified.json()).toEqual({ sso: false })

    await prisma.ssoProvider.update({ where: { providerId }, data: { domainVerified: true } })

    const verified = await resolveSso(resolveRequest(`anyone@${company.domain}`))
    expect(await verified.json()).toEqual({ sso: true, providerId })
  })

  // The answer depends on the domain only, so the endpoint cannot be walked to learn who has an account.
  it("answers the same for an address that has no account at all", async () => {
    const { company, adminUser } = await setupCompanyWithViewerAndAdmin("resolve-oracle", throwawayCompanyIds)

    const providerId = `itest-resolve-oracle-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com/resolve-oracle",
        providerId,
        domain: company.domain,
        organizationId: company.id,
        userId: adminUser.id,
        domainVerified: true,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    const strangerEmail = `nobody-here-${Date.now()}@${company.domain}`
    expect(await prisma.user.count({ where: { email: strangerEmail } })).toBe(0)

    const stranger = await resolveSso(resolveRequest(strangerEmail))
    expect(await stranger.json()).toEqual({ sso: true, providerId })
  })

  // Holding an account is not enough either: a domain without a verified provider is refused.
  it("answers sso:false for a real account whose domain has no provider", async () => {
    const { adminUser } = await setupCompanyWithViewerAndAdmin("resolve-nodomain", throwawayCompanyIds)

    const res = await resolveSso(resolveRequest(adminUser.email))
    expect(await res.json()).toEqual({ sso: false })
  })
})

import { describe, it, expect, afterEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { findCompanyProvider } from "@/lib/sso/provider"
import { GET, POST, PATCH, DELETE } from "@/app/api/sso/provider/route"
import {
  jsonRequest,
  setupCompanyWithViewerAndAdmin,
  ssoCleanup,
  stubProviderRegistration,
} from "./sso.fixtures"

// Route handlers read next/headers, which throws outside a request, so it returns the headers a test set.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => headersState.current }))

const throwawayCompanyIds = ssoCleanup({})

describe("provider route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("gates writes, masks reads, preserves secrets on a metadata-only PATCH, and enforces the ssoMandatory delete guard", async () => {
    const { company, adminUser, viewerHeaders, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "route-lifecycle",
      throwawayCompanyIds
    )

    const createBody = {
      issuer: "https://idp.example.com/route-lifecycle",
      domain: company.domain,
      clientId: "route-client-id",
      clientSecret: "route-super-secret",
      discoveryEndpoint: "https://idp.example.com/route-lifecycle/.well-known/openid-configuration",
    }

    // A viewer holds sso:read but not sso:config, so POST is refused before reaching the plugin.
    headersState.current = viewerHeaders
    const rejected = await POST(jsonRequest("POST", createBody))
    expect(rejected.status).toBe(403)
    expect(await findCompanyProvider(company.id)).toBeNull()

    // The administrator passes the gate; only the plugin registration call is stubbed.
    const registerSpy = await stubProviderRegistration(adminUser.id)
    headersState.current = adminHeaders
    const created = await POST(jsonRequest("POST", createBody))
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { provider: { providerId: string } }
    expect(createdBody.provider.providerId).toBe(`sso-${company.id}`)
    expect(JSON.stringify(createdBody)).not.toContain("route-super-secret")
    registerSpy.mockRestore()

    // GET, still gated on sso:read only, returns the same masked shape to the Viewer.
    headersState.current = viewerHeaders
    const got = await GET()
    expect(got.status).toBe(200)
    const gotBody = (await got.json()) as { provider: { clientIdLastFour: string | null } }
    expect(gotBody.provider.clientIdLastFour).toBe("t-id") // last 4 of "route-client-id"
    expect(JSON.stringify(gotBody)).not.toContain("route-super-secret")

    // A metadata-only PATCH runs updateSSOProvider for real and must keep the stored client credentials.
    headersState.current = adminHeaders
    const newDomain = `patched-${company.domain}`
    const patched = await PATCH(jsonRequest("PATCH", { domain: newDomain }))
    expect(patched.status).toBe(200)

    const afterPatch = await authPrisma.ssoProvider.findUniqueOrThrow({
      where: { providerId: `sso-${company.id}` },
    })
    expect(afterPatch.domain).toBe(newDomain)
    const oidcConfig = JSON.parse(afterPatch.oidcConfig!) as {
      clientId?: string
      clientSecret?: string
      discoveryEndpoint?: string
    }
    expect(oidcConfig.clientId).toBe("route-client-id")
    expect(oidcConfig.clientSecret).toBe("route-super-secret")
    expect(oidcConfig.discoveryEndpoint).toBe(createBody.discoveryEndpoint)

    // DELETE is blocked with 409 while the company mandates SSO.
    await prisma.company.update({ where: { id: company.id }, data: { ssoMandatory: true } })
    const blocked = await DELETE()
    expect(blocked.status).toBe(409)
    expect(await findCompanyProvider(company.id)).not.toBeNull()

    // Turning the policy off lets the same Administrator remove the provider.
    await prisma.company.update({ where: { id: company.id }, data: { ssoMandatory: false } })
    const deleted = await DELETE()
    expect(deleted.status).toBe(200)
    expect(await findCompanyProvider(company.id)).toBeNull()
  })

  it("404s on PATCH/DELETE when the company has no provider configured (GET returns provider: null instead, by design)", async () => {
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("route-404", throwawayCompanyIds)

    headersState.current = adminHeaders
    // GET never 404s: an unconfigured company gets { provider: null } for its empty state.
    const got = await GET()
    expect(got.status).toBe(200)
    expect(await got.json()).toEqual({ provider: null })

    expect((await PATCH(jsonRequest("PATCH", { domain: "whatever.test" }))).status).toBe(404)
    expect((await DELETE()).status).toBe(404)
  })
})

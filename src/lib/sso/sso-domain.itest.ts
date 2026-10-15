import { describe, it, expect, afterEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { POST as domainPOST, PUT as domainPUT } from "@/app/api/sso/provider/domain/route"
import { badGatewayError, conflictError, setupCompanyWithViewerAndAdmin, ssoCleanup } from "./sso.fixtures"

// Route handlers read next/headers, which throws outside a request, so it returns the headers a test set.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => headersState.current }))

const throwawayCompanyIds = ssoCleanup({ prefix: "itest-domain-" })

describe("domain verification route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects a Viewer on both POST and PUT", async () => {
    const { viewerHeaders } = await setupCompanyWithViewerAndAdmin("domain-viewer", throwawayCompanyIds)
    headersState.current = viewerHeaders
    expect((await domainPOST()).status).toBe(403)
    expect((await domainPUT()).status).toBe(403)
  })

  it("POST 404s when the company has no provider configured", async () => {
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-404", throwawayCompanyIds)
    headersState.current = adminHeaders
    expect((await domainPOST()).status).toBe(404)
  })

  it("PUT 404s when the company has no provider configured", async () => {
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-404-put", throwawayCompanyIds)
    headersState.current = adminHeaders
    expect((await domainPUT()).status).toBe(404)
  })

  it("POST 409s when the provider's domain is already verified", async () => {
    const { company, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "domain-verified",
      throwawayCompanyIds
    )
    await authPrisma.ssoProvider.create({
      data: {
        providerId: `itest-domain-verified-${Date.now()}`,
        issuer: "https://idp.example.com/domain-verified",
        domain: company.domain,
        organizationId: company.id,
        userId: adminUser.id,
        domainVerified: true,
      },
    })

    headersState.current = adminHeaders
    expect((await domainPOST()).status).toBe(409)
  })

  it("POST issues a real verification token and re-points ownership; PUT maps the plugin's DNS failure to 409", async () => {
    const { company, viewerUser, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "domain-flow",
      throwawayCompanyIds
    )
    const providerId = `itest-domain-flow-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        providerId,
        issuer: "https://idp.example.com/domain-flow",
        domain: company.domain,
        organizationId: company.id,
        userId: viewerUser.id, // proves takeOwnership repoints it to the caller below
        domainVerified: false,
      },
    })

    headersState.current = adminHeaders
    const posted = await domainPOST()
    expect(posted.status).toBe(200)
    const postedBody = (await posted.json()) as { record: { name: string; value: string } }
    expect(postedBody.record.name).toBe(`_better-auth-token-${providerId}.${company.domain}`)
    expect(postedBody.record.value).toBeTruthy()

    const afterPost = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId } })
    expect(afterPost.userId).toBe(adminUser.id)

    const verifySpy = vi.spyOn(auth.api, "verifyDomain").mockRejectedValue(badGatewayError())
    const putRes = await domainPUT()
    verifySpy.mockRestore()
    expect(putRes.status).toBe(409)
    const putBody = (await putRes.json()) as { error: string }
    expect(putBody.error).toContain("DNS record")

    const afterPut = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId } })
    expect(afterPut.domainVerified).toBe(false)
  })

  it("PUT stubbed to reject writes no audit entry and still maps to 409", async () => {
    const { company, viewerUser, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "domain-put-stub",
      throwawayCompanyIds
    )
    const providerId = `itest-domain-put-stub-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        providerId,
        issuer: "https://idp.example.com/domain-put-stub",
        domain: company.domain,
        organizationId: company.id,
        userId: viewerUser.id,
        domainVerified: false,
      },
    })

    const verifySpy = vi.spyOn(auth.api, "verifyDomain").mockRejectedValue(badGatewayError())
    headersState.current = adminHeaders
    const putRes = await domainPUT()
    expect(putRes.status).toBe(409)
    verifySpy.mockRestore()

    const afterPut = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId } })
    expect(afterPut.userId).toBe(adminUser.id) // takeOwnership still ran before the plugin call
    expect(afterPut.domainVerified).toBe(false)

    const audits = await prisma.auditLog.findMany({ where: { targetId: providerId } })
    expect(audits).toHaveLength(0)
  })

  it("PUT surfaces the plugin's CONFLICT response instead of the generic DNS message", async () => {
    const { company, viewerUser, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "domain-put-conflict",
      throwawayCompanyIds
    )
    const providerId = `itest-domain-put-conflict-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        providerId,
        issuer: "https://idp.example.com/domain-put-conflict",
        domain: company.domain,
        organizationId: company.id,
        userId: viewerUser.id,
        domainVerified: true, // already verified, matching the shape of the real CONFLICT case
      },
    })

    const verifySpy = vi.spyOn(auth.api, "verifyDomain").mockRejectedValue(conflictError())
    headersState.current = adminHeaders
    const putRes = await domainPUT()
    verifySpy.mockRestore()

    expect(putRes.status).toBe(409)
    const putBody = (await putRes.json()) as { error: string }
    expect(putBody.error).toBe("Domain has already been verified")
    expect(putBody.error).not.toContain("DNS record")

    const afterPut = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId } })
    expect(afterPut.userId).toBe(adminUser.id) // takeOwnership still ran before the plugin call

    const audits = await prisma.auditLog.findMany({ where: { targetId: providerId } })
    expect(audits).toHaveLength(0)
  })

  it("PUT writes an audit entry and reports domainVerified on a successful verification", async () => {
    const { company, viewerUser, adminHeaders } = await setupCompanyWithViewerAndAdmin(
      "domain-put-ok",
      throwawayCompanyIds
    )
    const providerId = `itest-domain-put-ok-${Date.now()}`
    await authPrisma.ssoProvider.create({
      data: {
        providerId,
        issuer: "https://idp.example.com/domain-put-ok",
        domain: company.domain,
        organizationId: company.id,
        userId: viewerUser.id,
        domainVerified: false,
      },
    })

    const verifySpy = vi.spyOn(auth.api, "verifyDomain").mockResolvedValue(undefined)
    headersState.current = adminHeaders
    const putRes = await domainPUT()
    expect(putRes.status).toBe(200)
    expect(await putRes.json()).toEqual({ domainVerified: true })
    verifySpy.mockRestore()

    const audits = await prisma.auditLog.findMany({ where: { targetId: providerId } })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.action).toBe(AUDIT_ACTIONS.SSO_DOMAIN_VERIFY)
    expect(audits[0]?.companyId).toBe(company.id)
  })
})

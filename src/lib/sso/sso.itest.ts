import { describe, it, expect, afterAll, afterEach, vi } from "vitest"
import bcrypt from "bcryptjs"
import { convertSetCookieToCookie } from "better-auth/test"
import { APIError } from "better-auth/api"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { findCompanyProvider, takeOwnership, maskedProvider } from "@/lib/sso/provider"
import { GET, POST, PATCH, DELETE } from "@/app/api/sso/provider/route"
import { POST as domainPOST, PUT as domainPUT } from "@/app/api/sso/provider/domain/route"

const PROVIDER_ID = "itest-sso-provider"

// Route handlers resolve the caller's session through next/headers's headers(),
// which throws outside a real Next request scope (verified by running it plain
// in node: "headers was called outside a request scope"). Stub it to hand back
// whatever Headers object the current test set, so requirePermission's
// getSession() -> auth.api.getSession() sees the real signed-in cookie the same
// way an actual HTTP request would.
const headersState = vi.hoisted(() => ({ current: new Headers() }))
vi.mock("next/headers", () => ({
  headers: async () => headersState.current,
}))

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

describe("provider helpers", () => {
  it("finds the company provider and masks its secret", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await prisma.ssoProvider.deleteMany({ where: { organizationId: admin.companyId } })
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-masked",
        domain: "datashield.local",
        organizationId: admin.companyId,
        oidcConfig: JSON.stringify({ clientId: "client-1234", clientSecret: "shh", discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration" }),
      },
    })

    const found = await findCompanyProvider(admin.companyId)
    expect(found?.providerId).toBe("itest-masked")

    const masked = maskedProvider(found!)
    expect(masked.clientIdLastFour).toBe("1234")
    expect(JSON.stringify(masked)).not.toContain("shh")
  })

  it("re-points ownership at the calling admin", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await takeOwnership("itest-masked", admin.id)
    const row = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-masked" } })
    expect(row.userId).toBe(admin.id)
  })
})

// The plugin's registerSSOProvider always runs a live OIDC discovery fetch
// against the supplied issuer/discoveryEndpoint unless the caller sets
// oidcConfig.skipDiscovery (verified by reading registerSSOProvider in
// node_modules/@better-auth/sso/dist/index.mjs: discoverOIDCConfig() is only
// skipped `if (body.oidcConfig && !body.oidcConfig.skipDiscovery)`), and
// route.ts's POST body never sets that flag. Reaching the plugin's own
// discovery endpoint also requires the URL's origin to be in the auth
// instance's trustedOrigins, which this app never configures for arbitrary
// customer IdPs. So a real POST through the route can't succeed offline; the
// route's own logic (permission gate, the follow-up prisma writes, masking,
// audit) is what this suite is verifying, not the plugin's own discovery
// flow (that's the plugin's own test surface). Stub just that one plugin
// call to perform the equivalent row insert, and leave every other auth.api
// method (getSession, updateSSOProvider, signInEmail) real.
async function stubProviderRegistration(ownerId: string) {
  return vi.spyOn(auth.api, "registerSSOProvider").mockImplementation(async (args) => {
    const body = args.body as {
      providerId: string
      issuer: string
      domain: string
      oidcConfig: Record<string, unknown>
    }
    await authPrisma.ssoProvider.create({
      data: {
        providerId: body.providerId,
        issuer: body.issuer,
        domain: body.domain,
        domainVerified: false,
        oidcConfig: JSON.stringify(body.oidcConfig),
        userId: ownerId,
      },
    })
    return { providerId: body.providerId } as Awaited<ReturnType<typeof auth.api.registerSSOProvider>>
  })
}

async function setupCompanyWithViewerAndAdmin(label: string) {
  const company = await prisma.company.create({
    data: { name: `${label} Co`, domain: `${label}-${Date.now()}.test` },
  })
  await seedPresetsForCompany(prisma, company.id)
  const viewerRoleId = await resolvePresetRoleId(prisma, company.id, "Viewer")
  const administratorRoleId = await resolvePresetRoleId(prisma, company.id, "Administrator")

  const password = "CorrectHorse1!"
  const hashedPassword = await bcrypt.hash(password, 10)

  const viewerEmail = `${label}-viewer-${Date.now()}@test.local`
  const viewerUser = await prisma.user.create({
    data: { email: viewerEmail, companyId: company.id, roleId: viewerRoleId, emailVerified: true },
  })
  await prisma.account.create({
    data: { accountId: viewerUser.id, providerId: "credential", userId: viewerUser.id, password: hashedPassword },
  })

  const adminEmail = `${label}-admin-${Date.now()}@test.local`
  const adminUser = await prisma.user.create({
    data: { email: adminEmail, companyId: company.id, roleId: administratorRoleId, emailVerified: true },
  })
  await prisma.account.create({
    data: { accountId: adminUser.id, providerId: "credential", userId: adminUser.id, password: hashedPassword },
  })

  const viewerHeaders = await signInAndGetCookieHeaders(viewerEmail, password)
  const adminHeaders = await signInAndGetCookieHeaders(adminEmail, password)

  return { company, viewerUser, adminUser, viewerHeaders, adminHeaders }
}

function jsonRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/sso/provider", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe("provider route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("gates writes, masks reads, preserves secrets on a metadata-only PATCH, and enforces the ssoMandatory delete guard", async () => {
    const { company, adminUser, viewerHeaders, adminHeaders } = await setupCompanyWithViewerAndAdmin("route-lifecycle")

    const createBody = {
      issuer: "https://idp.example.com/route-lifecycle",
      domain: company.domain,
      clientId: "route-client-id",
      clientSecret: "route-super-secret",
      discoveryEndpoint: "https://idp.example.com/route-lifecycle/.well-known/openid-configuration",
    }

    // Viewer has sso:read but not sso:config: POST is rejected before ever
    // reaching the plugin.
    headersState.current = viewerHeaders
    const rejected = await POST(jsonRequest("POST", createBody))
    expect(rejected.status).toBe(403)
    expect(await findCompanyProvider(company.id)).toBeNull()

    // Administrator clears the gate and creates the provider. Stub only the
    // plugin's own registration call (see stubProviderRegistration's comment).
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

    // A metadata-only PATCH (domain change, no client fields) goes through
    // auth.api.updateSSOProvider for real: no network call is involved for a
    // domain/issuer-only update (verified by reading updateSSOProvider in
    // node_modules/@better-auth/sso/dist/index.mjs; the oidcConfig branch only
    // calls validateSkipDiscoveryEndpoints + mergeOIDCConfig, never
    // discoverOIDCConfig). mergeOIDCConfig there falls back to the current
    // stored clientId/clientSecret/discoveryEndpoint with `updates.x ?? current.x`
    // whenever the PATCH body omits them, so this proves that fallback holds
    // through the real route, not just the library source.
    headersState.current = adminHeaders
    const newDomain = `patched-${company.domain}`
    const patched = await PATCH(jsonRequest("PATCH", { domain: newDomain }))
    expect(patched.status).toBe(200)

    const afterPatch = await authPrisma.ssoProvider.findUniqueOrThrow({ where: { providerId: `sso-${company.id}` } })
    expect(afterPatch.domain).toBe(newDomain)
    const oidcConfig = JSON.parse(afterPatch.oidcConfig!) as { clientId?: string; clientSecret?: string; discoveryEndpoint?: string }
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
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("route-404")

    headersState.current = adminHeaders
    // GET never 404s: it returns { provider: null } for "not configured yet"
    // (route.ts:27-32), the shape the dashboard uses to render an empty state.
    const got = await GET()
    expect(got.status).toBe(200)
    expect(await got.json()).toEqual({ provider: null })

    expect((await PATCH(jsonRequest("PATCH", { domain: "whatever.test" }))).status).toBe(404)
    expect((await DELETE()).status).toBe(404)
  })
})

// requestDomainVerification (index.mjs:1561-1596) never touches the network:
// it only writes a verification row and returns its token, so it is called
// for real below, same as this suite's other non-network auth.api calls.
// verifyDomain (index.mjs:1598-1671) does a real dns.resolveTxt lookup once it
// gets past its early validation, which would pull a live DNS dependency into
// this suite (CI's egress and failure timing for an unresolvable name are not
// something this suite should rely on). Every verifyDomain call below is
// therefore stubbed to reject with the plugin's actual APIError shape for the
// case under test (status/body.code copied from index.mjs), so the route's
// error-mapping logic is proven without any real network dependency:
//   BAD_GATEWAY, code DOMAIN_VERIFICATION_FAILED -> TXT record absent/stale
//   CONFLICT, code DOMAIN_VERIFIED               -> already verified
const badGatewayError = () =>
  new APIError("BAD_GATEWAY", {
    message: "Unable to verify domain ownership for example.com. Try again later",
    code: "DOMAIN_VERIFICATION_FAILED",
  })
const conflictError = () =>
  new APIError("CONFLICT", {
    message: "Domain has already been verified",
    code: "DOMAIN_VERIFIED",
  })

describe("domain verification route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects a Viewer on both POST and PUT", async () => {
    const { viewerHeaders } = await setupCompanyWithViewerAndAdmin("domain-viewer")
    headersState.current = viewerHeaders
    expect((await domainPOST()).status).toBe(403)
    expect((await domainPUT()).status).toBe(403)
  })

  it("POST 404s when the company has no provider configured", async () => {
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-404")
    headersState.current = adminHeaders
    expect((await domainPOST()).status).toBe(404)
  })

  it("PUT 404s when the company has no provider configured", async () => {
    const { adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-404-put")
    headersState.current = adminHeaders
    expect((await domainPUT()).status).toBe(404)
  })

  it("POST 409s when the provider's domain is already verified", async () => {
    const { company, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-verified")
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
    const { company, viewerUser, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-flow")
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
    const { company, viewerUser, adminUser, adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-put-stub")
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
      "domain-put-conflict"
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
    const { company, viewerUser, adminHeaders } = await setupCompanyWithViewerAndAdmin("domain-put-ok")
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
    expect(audits[0].action).toBe(AUDIT_ACTIONS.SSO_DOMAIN_VERIFY)
    expect(audits[0].companyId).toBe(company.id)
  })
})

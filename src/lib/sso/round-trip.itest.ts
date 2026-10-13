import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { convertSetCookieToCookie } from "better-auth/test"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { startStubIdp } from "./stub-idp"

// Runs a real OIDC callback against a local stub IdP, with throwaway companies so parallel suites never race on the seeded admin.

let idp: Awaited<ReturnType<typeof startStubIdp>>
let ownerCompanyId: string
let otherCompanyId: string
let providerId: string
let ssoDomain: string
let matchUser: { id: string; email: string }
let mismatchUser: { id: string; email: string }
let unknownEmail: string

beforeAll(async () => {
  idp = await startStubIdp()

  const suffix = Date.now()
  ssoDomain = `round-trip-${suffix}.test`
  providerId = `itest-round-trip-${suffix}`

  const ownerCompany = await prisma.company.create({
    data: { name: "Round Trip Co", domain: `round-trip-owner-${suffix}.test` },
  })
  ownerCompanyId = ownerCompany.id

  const otherCompany = await prisma.company.create({
    data: { name: "Round Trip Other Co", domain: `round-trip-other-${suffix}.test` },
  })
  otherCompanyId = otherCompany.id

  // Load-bearing: the plugin only links an SSO identity to a pre-provisioned account on a verified domain.
  await authPrisma.ssoProvider.create({
    data: {
      providerId,
      issuer: idp.issuer,
      domain: ssoDomain,
      domainVerified: true,
      organizationId: ownerCompanyId,
      oidcConfig: JSON.stringify({
        clientId: idp.clientId,
        clientSecret: idp.clientSecret,
        discoveryEndpoint: idp.discoveryEndpoint,
        pkce: true,
        scopes: ["openid", "email", "profile"],
      }),
    },
  })

  // Pre-provisioned in the provider's own company: the login that must succeed.
  const owner = await prisma.user.create({
    data: { email: `match-${suffix}@${ssoDomain}`, companyId: ownerCompanyId, emailVerified: false },
  })
  matchUser = { id: owner.id, email: owner.email }

  // Pre-provisioned on the verified domain but in another company: the login the tenant guard must refuse.
  const other = await prisma.user.create({
    data: { email: `mismatch-${suffix}@${ssoDomain}`, companyId: otherCompanyId, emailVerified: false },
  })
  mismatchUser = { id: other.id, email: other.email }

  // No user is ever created at this address: proves disableImplicitSignUp.
  unknownEmail = `unknown-${suffix}@${ssoDomain}`
})

afterAll(async () => {
  await prisma.ssoProvider.deleteMany({ where: { providerId } })
  await prisma.user.deleteMany({ where: { id: { in: [matchUser.id, mismatchUser.id] } } })
  await prisma.company.deleteMany({ where: { id: { in: [ownerCompanyId, otherCompanyId] } } })
  await idp.close()
})

// Starts a real authorization request and mints a matching code, keeping the signed state cookie to replay like a browser.
async function beginAuthorization(email: string): Promise<{ code: string; state: string; cookies: Headers }> {
  const authRes = await auth.api.signInSSO({
    body: { providerId, callbackURL: "/dashboard" },
    asResponse: true,
  })
  const cookies = convertSetCookieToCookie(authRes.headers)
  const body = (await authRes.json()) as { url: string; redirect: boolean }
  const state = new URL(body.url).searchParams.get("state")
  if (!state) throw new Error("stub idp: authorization URL is missing its state param")
  const code = idp.issueCode(email, `sub-${email}`)
  return { code, state, cookies }
}

describe("OIDC round trip against a stub IdP", () => {
  it("redirects to the stub IdP for a provider that exists", async () => {
    const res = await auth.api.signInSSO({
      body: { providerId, callbackURL: "/dashboard" },
    })
    expect(res.redirect).toBe(true)
    expect(res.url).toContain(idp.issuer)
    expect(new URL(res.url).searchParams.get("state")).toBeTruthy()
  })

  // Control case: if a matching tenant failed, the mismatch test below would prove nothing.
  it("completes the round trip and issues a real, usable session for a tenant-matched user", async () => {
    const { code, state, cookies } = await beginAuthorization(matchUser.email)
    const res = await auth.api.callbackSSO({
      params: { providerId },
      query: { code, state },
      headers: cookies,
      asResponse: true,
    })

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("/dashboard")
    // A session token specifically, since the failure paths also set a cookie that clears the state.
    expect(res.headers.get("set-cookie") ?? "").toContain("session_token")

    const cookieHeaders = convertSetCookieToCookie(res.headers)
    const session = await auth.api.getSession({ headers: cookieHeaders })
    expect(session?.user.id).toBe(matchUser.id)
    expect(session?.user.email).toBe(matchUser.email)

    const linkedAccount = await prisma.account.findFirst({
      where: { userId: matchUser.id, providerId },
    })
    expect(linkedAccount).not.toBeNull()
  })

  // Property 1: on a tenant mismatch, provisionUser deletes the session row and throws before any cookie is set.
  it("fires the tenant guard on a real callback: a company mismatch ends with no usable session", async () => {
    const { code, state, cookies } = await beginAuthorization(mismatchUser.email)
    const res = await auth.api.callbackSSO({
      params: { providerId },
      query: { code, state },
      headers: cookies,
      asResponse: true,
    })

    // FORBIDDEN, not a redirect, and the only cookie is the expired state one, never a session token.
    expect(res.status).toBe(403)
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token")

    // Linking happens before provisionUser, so the account exists but no session survives.
    const linkedAccount = await prisma.account.findFirst({
      where: { userId: mismatchUser.id, providerId },
    })
    expect(linkedAccount).not.toBeNull()

    const sessions = await prisma.session.findMany({ where: { userId: mismatchUser.id } })
    expect(sessions).toHaveLength(0)

    // No cookie was issued, so the session table itself is checked rather than trusting that absence.
    const anySession = await prisma.session.findFirst({ where: { userId: mismatchUser.id } })
    expect(anySession).toBeNull()
  })

  // Property 2: disableImplicitSignUp means an unknown email creates nothing, even with a valid token on a verified domain.
  it("does not create an account for an unknown address (disableImplicitSignUp holds through a real callback)", async () => {
    expect(await prisma.user.count({ where: { email: unknownEmail } })).toBe(0)

    const { code, state, cookies } = await beginAuthorization(unknownEmail)
    const res = await auth.api.callbackSSO({
      params: { providerId },
      query: { code, state },
      headers: cookies,
      asResponse: true,
    })

    // An unknown email comes back as a redirect carrying an error, with no session cookie.
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("error=")
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token")

    expect(await prisma.user.count({ where: { email: unknownEmail } })).toBe(0)
    expect(
      await prisma.account.findFirst({ where: { providerId, accountId: `sub-${unknownEmail}` } })
    ).toBeNull()
  })
})

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { convertSetCookieToCookie } from "better-auth/test"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { startStubIdp } from "./stub-idp"

// Drives a real OIDC callback through the plugin's own endpoints: discovery,
// the authorization redirect, the token exchange against the stub, JWKS
// signature validation, account linking on a verified domain, the tenant
// guard configured in src/lib/auth/server.ts, and disableImplicitSignUp.
// Every other SSO suite stubs out the parts of the plugin that would need
// the network (see sso.itest.ts); this one deliberately runs the network
// path for real against a local, DNS-free stub so the callback wiring gets
// exercised at least once.
//
// A dedicated pair of throwaway companies and users, never the shared seeded
// admin@datashield.local: itest files run in parallel against one seeded DB,
// and mutating that shared row races every other suite that reads it (see
// PR #144, and sso.itest.ts's setupCompanyWithViewerAndAdmin comment).

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

  // domainVerified: true is load-bearing, not decorative: link-account.mjs
  // only links an SSO identity to a pre-provisioned account (no password, no
  // confirmed local email) when the provider's domain is verified. Without
  // it, both the match and mismatch cases below would fail account linking
  // before the tenant guard ever gets a chance to run.
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

  // Pre-provisioned, belongs to the company the provider is bound to: the
  // login that must succeed normally.
  const owner = await prisma.user.create({
    data: { email: `match-${suffix}@${ssoDomain}`, companyId: ownerCompanyId, emailVerified: false },
  })
  matchUser = { id: owner.id, email: owner.email }

  // Pre-provisioned at the provider's verified domain, but belongs to a
  // different company than the one the provider is registered under: the
  // login the tenant guard exists to refuse.
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

// Starts a fresh authorization request (a real call into signInSSO, which
// runs discovery against the stub) and mints a matching code on the stub for
// the given email. signInSSO also sets a signed "state" cookie that the
// callback's parseState re-checks against the stored verification value
// (storeStateStrategy defaults to "database", which still binds state to a
// cookie, not just the DB row); asResponse: true on both calls is what makes
// that cookie visible to capture and replay, the same way a browser carrying
// it across the redirect would.
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

  // Property: a matching tenant signs in normally. This is the control case
  // for the mismatch test below -- if this one did not pass, a failure there
  // would prove nothing about the guard specifically.
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
    // Specifically a session token, not merely some cookie: the callback also
    // clears its own "state" cookie on the failure paths below, so a truthy
    // Set-Cookie alone would not distinguish success from rejection.
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

  // Property 1: the tenant guard fires on a real callback. server.ts's
  // provisionUser hook runs after handleOAuthUserInfo has already created a
  // session row but before setSessionCookie, compares the linked user's
  // company against the provider's organizationId via isSameTenant, and on a
  // mismatch deletes the session row and throws FORBIDDEN. Only the pure
  // isSameTenant function had a unit test before this; this proves the
  // wiring, the ordering (no cookie is ever set), and the cleanup.
  it("fires the tenant guard on a real callback: a company mismatch ends with no usable session", async () => {
    const { code, state, cookies } = await beginAuthorization(mismatchUser.email)
    const res = await auth.api.callbackSSO({
      params: { providerId },
      query: { code, state },
      headers: cookies,
      asResponse: true,
    })

    // Rejected before setSessionCookie ever runs, not redirected through it:
    // provisionUser's throw propagates as FORBIDDEN, not the plugin's normal
    // success redirect. The response does carry a Set-Cookie, but only the
    // expired one the plugin uses to clear its own "state" cookie once the
    // callback has consumed it; what must not appear is a session token.
    expect(res.status).toBe(403)
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token")

    // The account got linked (account linking happens before provisionUser
    // runs), but no session survives it.
    const linkedAccount = await prisma.account.findFirst({
      where: { userId: mismatchUser.id, providerId },
    })
    expect(linkedAccount).not.toBeNull()

    const sessions = await prisma.session.findMany({ where: { userId: mismatchUser.id } })
    expect(sessions).toHaveLength(0)

    // No cookie was issued for this attempt, so there is nothing to present
    // to getSession -- but confirm directly that no session exists to find,
    // rather than relying only on the absence of a cookie in this response.
    const anySession = await prisma.session.findFirst({ where: { userId: mismatchUser.id } })
    expect(anySession).toBeNull()
  })

  // Property 2: strict pre-provisioning holds. disableImplicitSignUp: true
  // plus never sending requestSignUp means an SSO login for an unknown email
  // must create nothing, even though the provider's domain is verified and
  // the id_token signature and claims check out.
  it("does not create an account for an unknown address (disableImplicitSignUp holds through a real callback)", async () => {
    expect(await prisma.user.count({ where: { email: unknownEmail } })).toBe(0)

    const { code, state, cookies } = await beginAuthorization(unknownEmail)
    const res = await auth.api.callbackSSO({
      params: { providerId },
      query: { code, state },
      headers: cookies,
      asResponse: true,
    })

    // handleOAuthUserInfo returns { error: "signup disabled" } for an unknown
    // email when disableSignUp is set, which the callback turns into a
    // redirect carrying an error query param -- not the plugin's normal
    // success redirect, and no session cookie either (the only Set-Cookie
    // here is the plugin expiring its own consumed "state" cookie).
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("error=")
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token")

    expect(await prisma.user.count({ where: { email: unknownEmail } })).toBe(0)
    expect(await prisma.account.findFirst({ where: { providerId, accountId: `sub-${unknownEmail}` } })).toBeNull()
  })
})

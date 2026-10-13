import { describe, it, expect, vi, afterEach } from "vitest"
import { generateKeyPairSync } from "crypto"
import { fetchGoogleUsers, googleForcePasswordReset, googleSignOut, testGoogleConnection } from "./google"

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

const config = {
  serviceAccountEmail: "sa@proj.iam.gserviceaccount.com",
  privateKey: pem,
  delegatedAdminEmail: "admin@x.com",
  domain: "x.com",
}

function res(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as Response
}

type Route = (url: string, init?: RequestInit) => Response | undefined

function mockFetch(...routes: Route[]) {
  return vi.spyOn(global, "fetch").mockImplementation((input, init) => {
    const url = String(input)
    if (url.startsWith("https://oauth2.googleapis.com/token"))
      return Promise.resolve(res({ access_token: "tok" }))
    for (const route of routes) {
      const r = route(url, init)
      if (r) return Promise.resolve(r)
    }
    return Promise.resolve(res({}))
  })
}

function assertionClaims(fetch: ReturnType<typeof mockFetch>) {
  const body = fetch.mock.calls.find(([u]) => String(u).includes("oauth2"))?.[1]?.body as URLSearchParams
  const [, payload] = String(body.get("assertion")).split(".")
  return JSON.parse(Buffer.from(payload, "base64url").toString())
}

const gUser = (email: string | undefined, extra: Record<string, unknown> = {}) => ({
  primaryEmail: email,
  name: { givenName: "Ada", familyName: "Lovelace" },
  ...extra,
})

afterEach(() => vi.restoreAllMocks())

describe("fetchGoogleUsers", () => {
  it("follows page tokens and lowercases emails", async () => {
    mockFetch((url) => {
      if (url.includes("pageToken=p2")) return res({ users: [gUser("b@x.com")] })
      if (url.includes("/directory/v1/users")) return res({ users: [gUser("A@X.com")], nextPageToken: "p2" })
    })

    const users = await fetchGoogleUsers(config)
    expect(users.map((u) => u.email)).toEqual(["a@x.com", "b@x.com"])
  })

  it("lists active users of the configured domain only", async () => {
    const fetch = mockFetch()
    await fetchGoogleUsers(config)
    const url = new URL(String(fetch.mock.calls.find(([u]) => String(u).includes("/users?"))?.[0]))
    expect(url.searchParams.get("domain")).toBe("x.com")
    expect(url.searchParams.get("query")).toBe("isSuspended=false")
  })

  it("reads department and 2SV, and skips users without an email", async () => {
    mockFetch((url) =>
      url.includes("/users?")
        ? res({
            users: [
              gUser("a@x.com", { organizations: [{ department: "Sales" }], isEnrolledIn2Sv: false }),
              gUser("b@x.com", { isEnrolledIn2Sv: "yes" }),
              gUser(undefined),
            ],
          })
        : undefined
    )

    const users = await fetchGoogleUsers(config)
    expect(users).toHaveLength(2)
    expect(users[0]).toMatchObject({ department: "Sales", mfaEnabled: false })
    expect(users[1].mfaEnabled).toBeUndefined()
  })

  it("signs a read-only assertion that impersonates the delegated admin", async () => {
    const fetch = mockFetch()
    await fetchGoogleUsers(config)
    const claims = assertionClaims(fetch)
    expect(claims).toMatchObject({ iss: config.serviceAccountEmail, sub: "admin@x.com" })
    expect(claims.scope).toBe("https://www.googleapis.com/auth/admin.directory.user.readonly")
  })

  it("accepts a private key pasted with literal \\n sequences", async () => {
    mockFetch()
    const flattened = { ...config, privateKey: pem.replace(/\n/g, "\\n") }
    await expect(fetchGoogleUsers(flattened)).resolves.toEqual([])
  })

  it("throws when the Directory API fails mid-sync", async () => {
    mockFetch((url) => (url.includes("/users?") ? res({}, 403) : undefined))
    await expect(fetchGoogleUsers(config)).rejects.toThrow("Directory API error (403)")
  })
})

describe("Google remediation", () => {
  it("signs out with the security scope", async () => {
    const fetch = mockFetch()
    await googleSignOut(config, "a@x.com")
    expect(assertionClaims(fetch).scope).toBe("https://www.googleapis.com/auth/admin.directory.user.security")
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("/users/a%40x.com/signOut"))
    expect(call?.[1]?.method).toBe("POST")
  })

  it("forces a password change at next sign-in", async () => {
    const fetch = mockFetch()
    await googleForcePasswordReset(config, "a@x.com")
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("/users/a%40x.com"))
    expect(call?.[1]?.method).toBe("PUT")
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ changePasswordAtNextLogin: true })
  })

  it("throws when the remediation call fails", async () => {
    mockFetch((url) => (url.includes("signOut") ? res({}, 404) : undefined))
    await expect(googleSignOut(config, "a@x.com")).rejects.toThrow("Google signOut failed (404)")
  })
})

describe("testGoogleConnection", () => {
  it("returns the auth error instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res({ error_description: "Invalid grant" }, 400))
    expect(await testGoogleConnection(config)).toEqual({ ok: false, error: "Invalid grant" })
  })
})

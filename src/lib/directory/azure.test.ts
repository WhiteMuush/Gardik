import { describe, it, expect, vi, afterEach } from "vitest"
import { fetchAzureUsers, revokeAzureSessions, testAzureConnection } from "./azure"

const config = { tenantId: "tenant", clientId: "client", clientSecret: "secret" }

function res(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as Response
}

type Route = (url: string, init?: RequestInit) => Response | undefined

function mockFetch(...routes: Route[]) {
  return vi.spyOn(global, "fetch").mockImplementation((input, init) => {
    const url = String(input)
    if (url.includes("/oauth2/v2.0/token")) return Promise.resolve(res({ access_token: "tok" }))
    for (const route of routes) {
      const r = route(url, init)
      if (r) return Promise.resolve(r)
    }
    return Promise.resolve(res({ value: [] }))
  })
}

const user = (mail: string | null, upn = mail) => ({
  mail,
  userPrincipalName: upn,
  givenName: "Ada",
  surname: "Lovelace",
  department: "R&D",
})

afterEach(() => vi.restoreAllMocks())

describe("fetchAzureUsers", () => {
  it("follows nextLink pages and lowercases emails", async () => {
    mockFetch((url) => {
      if (url.includes("/users?")) return res({ value: [user("A@X.com")], "@odata.nextLink": "https://next" })
      if (url === "https://next") return res({ value: [user("b@x.com")] })
    })

    const users = await fetchAzureUsers(config)
    expect(users.map((u) => u.email)).toEqual(["a@x.com", "b@x.com"])
    expect(users[0]).toMatchObject({ firstName: "Ada", lastName: "Lovelace", department: "R&D" })
  })

  it("asks Graph for enabled accounts only", async () => {
    const fetch = mockFetch()
    await fetchAzureUsers(config)
    const listCall = fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes("/users?"))
    expect(listCall).toContain("accountEnabled eq true")
  })

  it("skips users without a mailbox", async () => {
    mockFetch((url) => (url.includes("/users?") ? res({ value: [user(null, "x@x.com")] }) : undefined))
    expect(await fetchAzureUsers(config)).toEqual([])
  })

  it("maps MFA registration by userPrincipalName", async () => {
    mockFetch((url) => {
      if (url.includes("userRegistrationDetails"))
        return res({ value: [{ userPrincipalName: "A@X.COM", isMfaRegistered: true }] })
      if (url.includes("/users?")) return res({ value: [user("a@x.com"), user("b@x.com")] })
    })

    const users = await fetchAzureUsers(config)
    expect(users.map((u) => u.mfaEnabled)).toEqual([true, undefined])
  })

  it("keeps syncing with MFA unknown when the report is forbidden", async () => {
    mockFetch((url) => {
      if (url.includes("userRegistrationDetails")) return res({}, 403)
      if (url.includes("/users?")) return res({ value: [user("a@x.com")] })
    })

    const [u] = await fetchAzureUsers(config)
    expect(u?.mfaEnabled).toBeUndefined()
  })

  it("throws the identity platform message when the token is refused", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res({ error_description: "AADSTS7000215: bad secret" }, 401))
    await expect(fetchAzureUsers(config)).rejects.toThrow("AADSTS7000215: bad secret")
  })

  it("throws when Graph fails mid-sync instead of returning a partial list", async () => {
    mockFetch((url) => (url.includes("/users?") ? res({}, 503) : undefined))
    await expect(fetchAzureUsers(config)).rejects.toThrow("Graph API error (503)")
  })
})

describe("revokeAzureSessions", () => {
  it("posts to the encoded user and throws on failure", async () => {
    const fetch = mockFetch((url) => (url.includes("revokeSignInSessions") ? res({}, 404) : undefined))
    await expect(revokeAzureSessions(config, "a b@x.com")).rejects.toThrow("(404)")
    const call = fetch.mock.calls.find(([u]) => String(u).includes("revokeSignInSessions"))
    expect(String(call?.[0])).toContain("/users/a%20b%40x.com/")
    expect(call?.[1]?.method).toBe("POST")
  })
})

describe("testAzureConnection", () => {
  it("reports the enabled user count", async () => {
    mockFetch((url) => (url.includes("$count") ? res(42) : undefined))
    expect(await testAzureConnection(config)).toEqual({ ok: true, userCount: 42 })
  })

  it("returns the error instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res({}, 400))
    expect(await testAzureConnection(config)).toEqual({ ok: false, error: "Azure auth failed (400)" })
  })
})

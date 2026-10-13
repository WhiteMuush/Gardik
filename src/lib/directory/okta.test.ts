import { describe, it, expect, vi, afterEach } from "vitest"
import { fetchOktaUsers, oktaExpirePassword, oktaRevokeSessions, testOktaConnection } from "./okta"

const config = { domain: "acme.okta.com", apiToken: "tok" }

function jsonRes(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(headers),
  }
}

const oktaUser = (id: string, email: string, login = email) => ({
  id,
  status: "ACTIVE",
  profile: { login, email, firstName: "A", lastName: "B" },
})

function mockUsers(...pages: { users: unknown[]; next?: string }[]) {
  return vi.spyOn(global, "fetch").mockImplementation((input: unknown) => {
    const url = String(input)
    if (url.includes("/factors")) return Promise.resolve(jsonRes([]) as Response)
    const page = pages.find((p, i) => (i === 0 ? !url.includes("after=") : url.includes(`after=${i}`)))!
    const link = page.next ? `<${page.next}>; rel="next"` : ""
    return Promise.resolve(jsonRes(page.users, link ? { link } : {}) as Response)
  })
}

afterEach(() => vi.restoreAllMocks())

describe("fetchOktaUsers MFA enrichment", () => {
  it("marks a user with an active factor as MFA enabled", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes("/factors")) return Promise.resolve(jsonRes([{ status: "ACTIVE" }]) as Response)
      return Promise.resolve(
        jsonRes([
          {
            id: "u1",
            status: "ACTIVE",
            profile: { login: "a@x.com", email: "a@x.com", firstName: "A", lastName: "B" },
          },
        ]) as Response
      )
    })

    const [user] = await fetchOktaUsers(config)
    expect(user.email).toBe("a@x.com")
    expect(user.mfaEnabled).toBe(true)
  })

  it("leaves MFA unknown when the factors call fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes("/factors")) return Promise.resolve({ ok: false, status: 500 } as Response)
      return Promise.resolve(
        jsonRes([
          {
            id: "u1",
            status: "ACTIVE",
            profile: { login: "a@x.com", email: "a@x.com", firstName: "A", lastName: "B" },
          },
        ]) as Response
      )
    })

    const [user] = await fetchOktaUsers(config)
    expect(user.mfaEnabled).toBeUndefined()
  })
})

describe("fetchOktaUsers", () => {
  it("follows the Link header and asks for active users only", async () => {
    const fetch = mockUsers(
      { users: [oktaUser("u1", "A@X.com")], next: "https://acme.okta.com/api/v1/users?after=1" },
      { users: [oktaUser("u2", "b@x.com")] }
    )
    const users = await fetchOktaUsers(config)
    expect(users.map((u) => u.email)).toEqual(["a@x.com", "b@x.com"])
    expect(String(fetch.mock.calls[0][0])).toContain('filter=status+eq+"ACTIVE"')
  })

  it("falls back to the login only when it is an email", async () => {
    mockUsers({ users: [oktaUser("u1", "", "Ada@X.com"), oktaUser("u2", "", "ada.lovelace")] })
    const users = await fetchOktaUsers(config)
    expect(users.map((u) => u.email)).toEqual(["ada@x.com"])
  })

  it("throws with Okta's message when the API refuses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonRes({ errorSummary: "Invalid token" }, {}, 401) as Response
    )
    await expect(fetchOktaUsers(config)).rejects.toThrow("Okta API error (401)")
  })
})

describe("Okta remediation", () => {
  it("clears sessions and expires the password of the encoded user", async () => {
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue(jsonRes({}) as Response)
    await oktaRevokeSessions(config, "a b@x.com")
    await oktaExpirePassword(config, "a b@x.com")
    expect(fetch.mock.calls.map(([u, init]) => [String(u), init?.method])).toEqual([
      ["https://acme.okta.com/api/v1/users/a%20b%40x.com/sessions", "DELETE"],
      ["https://acme.okta.com/api/v1/users/a%20b%40x.com/lifecycle/expire_password", "POST"],
    ])
  })

  it("throws when Okta refuses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonRes({}, {}, 403) as Response)
    await expect(oktaRevokeSessions(config, "a@x.com")).rejects.toThrow("(403)")
    await expect(oktaExpirePassword(config, "a@x.com")).rejects.toThrow("(403)")
  })
})

describe("testOktaConnection", () => {
  it("returns the error instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonRes({ errorSummary: "Invalid token" }, {}, 401) as Response
    )
    const result = await testOktaConnection(config)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("Okta API error (401)")
  })
})

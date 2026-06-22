import { describe, it, expect, vi, afterEach } from "vitest"
import { fetchOktaUsers } from "./okta"

const config = { domain: "acme.okta.com", apiToken: "tok" }

function jsonRes(body: unknown, headers: Record<string, string> = {}) {
  return { ok: true, status: 200, json: () => Promise.resolve(body), headers: new Headers(headers) }
}

afterEach(() => vi.restoreAllMocks())

describe("fetchOktaUsers MFA enrichment", () => {
  it("marks a user with an active factor as MFA enabled", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes("/factors")) return Promise.resolve(jsonRes([{ status: "ACTIVE" }]) as Response)
      return Promise.resolve(
        jsonRes([
          { id: "u1", status: "ACTIVE", profile: { login: "a@x.com", email: "a@x.com", firstName: "A", lastName: "B" } },
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
          { id: "u1", status: "ACTIVE", profile: { login: "a@x.com", email: "a@x.com", firstName: "A", lastName: "B" } },
        ]) as Response
      )
    })

    const [user] = await fetchOktaUsers(config)
    expect(user.mfaEnabled).toBeUndefined()
  })
})

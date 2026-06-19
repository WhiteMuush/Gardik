import { describe, it, expect, vi } from "vitest"

vi.mock("./crypto", () => ({
  encryptConfig: (data: object) => `enc:${JSON.stringify(data)}`,
}))

import { buildDirectoryConnection, REQUIRED_FIELDS } from "./validation"

describe("buildDirectoryConnection", () => {
  it("rejects missing type or name", () => {
    expect(buildDirectoryConnection({ name: "x" })).toEqual({ ok: false, error: "Missing fields" })
    expect(buildDirectoryConnection({ type: "OKTA", name: "  " })).toEqual({
      ok: false,
      error: "Missing fields",
    })
  })

  it("rejects unknown type", () => {
    expect(buildDirectoryConnection({ type: "NOPE", name: "x" })).toEqual({
      ok: false,
      error: "Invalid type: NOPE",
    })
  })

  it("reports each missing config field", () => {
    const res = buildDirectoryConnection({ type: "OKTA", name: "x", config: { domain: "d" } })
    expect(res).toEqual({ ok: false, error: "Missing config fields: apiToken" })
  })

  it("builds an encrypted payload for a valid non-SCIM connection", () => {
    const config = { domain: "d", apiToken: "t" }
    const res = buildDirectoryConnection({ type: "OKTA", name: "  My Okta  ", config })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.built.bearerToken).toBeUndefined()
    expect(res.built.data).toEqual({
      type: "OKTA",
      name: "My Okta",
      status: "PENDING",
      encryptedConfig: `enc:${JSON.stringify(config)}`,
    })
  })

  it("generates a bearer token and activates SCIM without requiring config", () => {
    const res = buildDirectoryConnection({ type: "SCIM", name: "scim" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.built.bearerToken).toMatch(/[0-9a-f-]{36}/)
    expect(res.built.data.status).toBe("ACTIVE")
    expect(res.built.data.encryptedConfig).toBe(
      `enc:${JSON.stringify({ bearerToken: res.built.bearerToken })}`
    )
  })

  it("SCIM requires no fields", () => {
    expect(REQUIRED_FIELDS.SCIM).toEqual([])
  })
})

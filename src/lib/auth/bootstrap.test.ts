import { describe, it, expect } from "vitest"
import { resolveBootstrapConfig, MIN_BOOTSTRAP_TOKEN_LENGTH } from "./bootstrap"

const token = "a".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)

describe("resolveBootstrapConfig", () => {
  it("stays silent when neither variable is set", () => {
    const result = resolveBootstrapConfig({})
    expect(result).toEqual({ ok: false, silent: true, reason: "not configured" })
  })

  it("names the missing token when only the email is set", () => {
    const result = resolveBootstrapConfig({ BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain("BOOTSTRAP_INVITE_TOKEN")
  })

  it("names the missing email when only the token is set", () => {
    const result = resolveBootstrapConfig({ BOOTSTRAP_INVITE_TOKEN: token })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain("BOOTSTRAP_ADMIN_EMAIL")
  })

  it("refuses a token below the minimum length", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: "a".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH - 1),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain(String(MIN_BOOTSTRAP_TOKEN_LENGTH))
  })

  it("refuses an address with no domain", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses a domain with no dot", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@localhost",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(false)
  })

  it("derives the company domain from the address", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result).toEqual({ ok: true, config: { email: "admin@acme.com", token, domain: "acme.com" } })
  })

  it("normalises case and surrounding whitespace on the address", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "  Admin@ACME.com  ",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.email).toBe("admin@acme.com")
    expect(result.config.domain).toBe("acme.com")
  })

  it("keeps the token exactly as supplied", () => {
    const mixed = `Aa1-_${"b".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)}`
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: mixed,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.token).toBe(mixed)
  })
})

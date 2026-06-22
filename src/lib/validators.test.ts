import { describe, it, expect } from "vitest"
import { isEmail } from "./validators"

describe("isEmail", () => {
  it("accepts a normal address", () => {
    expect(isEmail("jane.doe@acme.com")).toBe(true)
    expect(isEmail("a@b.co")).toBe(true)
  })

  it("rejects malformed addresses", () => {
    expect(isEmail("nope")).toBe(false)
    expect(isEmail("@acme.com")).toBe(false)
    expect(isEmail("jane@")).toBe(false)
    expect(isEmail("jane@acme")).toBe(false)
    expect(isEmail("jane@acme.")).toBe(false)
    expect(isEmail("a@@b.com")).toBe(false)
    expect(isEmail("jane doe@acme.com")).toBe(false)
  })

  it("does not blow up on a ReDoS-style payload", () => {
    const payload = "a".repeat(50000) + "!"
    const start = Date.now()
    expect(isEmail(payload)).toBe(false)
    expect(Date.now() - start).toBeLessThan(50)
  })
})

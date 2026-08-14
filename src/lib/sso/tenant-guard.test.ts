import { describe, it, expect } from "vitest"
import { isSameTenant } from "./tenant-guard"

describe("isSameTenant", () => {
  it("accepts a provider bound to the user's company", () => {
    expect(isSameTenant("company-a", "company-a")).toBe(true)
  })

  it("rejects a provider bound to another company", () => {
    expect(isSameTenant("company-a", "company-b")).toBe(false)
  })

  it("rejects a provider with no company at all", () => {
    expect(isSameTenant("company-a", null)).toBe(false)
    expect(isSameTenant("company-a", undefined)).toBe(false)
    expect(isSameTenant("company-a", "")).toBe(false)
  })
})

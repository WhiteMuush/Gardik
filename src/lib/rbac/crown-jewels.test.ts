import { describe, it, expect } from "vitest"
import { CROWN_JEWELS, containsCrownJewel } from "./crown-jewels"
import { PERMISSION_SET } from "./permissions"

describe("crown jewels", () => {
  it("lists the escalation-sensitive permissions", () => {
    for (const p of ["roles:manage", "users:manage", "sso:config", "sso:role_map"]) {
      expect(CROWN_JEWELS.has(p as never)).toBe(true)
    }
  })

  it("only contains real permissions", () => {
    for (const p of CROWN_JEWELS) expect(PERMISSION_SET.has(p)).toBe(true)
  })

  it("detects a crown jewel inside a permission list", () => {
    expect(containsCrownJewel(["alerts:read", "roles:manage"])).toBe(true)
    expect(containsCrownJewel(["alerts:read", "alerts:assign"])).toBe(false)
  })
})

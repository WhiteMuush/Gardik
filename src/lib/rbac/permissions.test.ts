import { describe, it, expect } from "vitest"
import { PERMISSIONS, PERMISSION_SET, isPermission } from "./permissions"

describe("permission catalog", () => {
  it("contains the core SOC and admin permissions", () => {
    for (const p of [
      "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
      "alerts:close", "alerts:remediate",
      "roles:manage", "users:manage", "sso:config", "sso:role_map",
      "policy:manage", "audit:read",
    ]) {
      expect(PERMISSION_SET.has(p as never)).toBe(true)
    }
  })

  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it("narrows unknown strings", () => {
    expect(isPermission("alerts:read")).toBe(true)
    expect(isPermission("alerts:launch_nukes")).toBe(false)
  })

  it("is frozen", () => {
    expect(Object.isFrozen(PERMISSIONS)).toBe(true)
  })
})

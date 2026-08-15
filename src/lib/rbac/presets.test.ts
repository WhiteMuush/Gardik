import { describe, it, expect } from "vitest"
import { PRESETS, ADMINISTRATOR, VIEWER_ROLE } from "./presets"
import { PERMISSIONS, PERMISSION_SET } from "./permissions"

describe("role presets", () => {
  it("Administrator holds every permission and is immutable", () => {
    const admin = PRESETS.find((p) => p.name === ADMINISTRATOR)!
    expect(admin.isSystem).toBe(true)
    expect(new Set(admin.permissions).size).toBe(PERMISSIONS.length)
  })

  it("Viewer holds only :read permissions", () => {
    const viewer = PRESETS.find((p) => p.name === VIEWER_ROLE)!
    expect(viewer.permissions.every((p) => p.endsWith(":read"))).toBe(true)
  })

  it("every preset permission is in the catalog", () => {
    for (const preset of PRESETS) {
      for (const p of preset.permissions) expect(PERMISSION_SET.has(p)).toBe(true)
    }
  })

  it("Security Manager cannot manage roles or the group->role map", () => {
    const sm = PRESETS.find((p) => p.name === "Security Manager")!
    expect(sm.permissions).not.toContain("roles:manage")
    expect(sm.permissions).not.toContain("sso:role_map")
  })
})

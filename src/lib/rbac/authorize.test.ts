import { describe, it, expect, vi } from "vitest"
import { authorize, getUserPermissions } from "./authorize"

describe("authorize", () => {
  it("allows only when the permission is present", () => {
    const perms = new Set(["alerts:read", "alerts:assign"])
    expect(authorize(perms, "alerts:assign")).toBe(true)
    expect(authorize(perms, "roles:manage")).toBe(false)
  })
})

describe("getUserPermissions", () => {
  it("returns an empty set for a user with no role (no-access pending)", async () => {
    const db = { role: { findUnique: vi.fn() } } as never
    expect((await getUserPermissions(db, null)).size).toBe(0)
  })

  it("returns the role's permissions", async () => {
    const db = {
      role: { findUnique: vi.fn().mockResolvedValue({ permissions: ["alerts:read"] }) },
    } as never
    const perms = await getUserPermissions(db, "role1")
    expect(perms.has("alerts:read")).toBe(true)
  })
})

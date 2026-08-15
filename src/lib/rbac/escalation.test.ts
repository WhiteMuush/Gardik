import { describe, it, expect } from "vitest"
import { isSubsetOf, excessPermissions } from "./escalation"

describe("no-escalation subset rule", () => {
  const actor = new Set(["alerts:read", "alerts:assign", "roles:read"])

  it("allows a target within the actor's permissions", () => {
    expect(isSubsetOf(actor, ["alerts:read"])).toBe(true)
    expect(isSubsetOf(actor, [])).toBe(true)
  })

  it("rejects a target holding a permission the actor lacks", () => {
    expect(isSubsetOf(actor, ["alerts:read", "roles:manage"])).toBe(false)
  })

  it("reports exactly which permissions exceed the actor", () => {
    expect(excessPermissions(actor, ["alerts:read", "roles:manage", "users:manage"]))
      .toEqual(["roles:manage", "users:manage"])
  })
})

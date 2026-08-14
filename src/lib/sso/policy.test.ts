import { describe, it, expect } from "vitest"
import { requiredPermissionFor } from "./policy"

describe("requiredPermissionFor", () => {
  it("guards every provider-management endpoint with sso:config", () => {
    for (const path of [
      "/sso/register",
      "/sso/update-provider",
      "/sso/request-domain-verification",
      "/sso/verify-domain",
    ]) {
      expect(requiredPermissionFor(path)).toBe("sso:config")
    }
  })

  it("leaves the sign-in and callback paths ungated", () => {
    expect(requiredPermissionFor("/sign-in/sso")).toBeNull()
    expect(requiredPermissionFor("/sso/callback/acme")).toBeNull()
  })
})

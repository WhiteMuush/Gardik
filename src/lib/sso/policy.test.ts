import { describe, it, expect } from "vitest"
import { requiredPermissionFor, deniesLocalSignIn } from "./policy"

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

describe("deniesLocalSignIn", () => {
  it("allows local sign-in when the policy is off", () => {
    expect(deniesLocalSignIn({ ssoMandatory: false }, { ssoExempt: false })).toBe(false)
  })

  it("denies local sign-in when the policy is on", () => {
    expect(deniesLocalSignIn({ ssoMandatory: true }, { ssoExempt: false })).toBe(true)
  })

  it("lets an exempt user through so a broken IdP cannot lock the company out", () => {
    expect(deniesLocalSignIn({ ssoMandatory: true }, { ssoExempt: true })).toBe(false)
  })
})

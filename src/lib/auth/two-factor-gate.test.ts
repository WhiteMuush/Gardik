import { describe, it, expect } from "vitest"
import { needsTwoFactorEnrollment } from "./two-factor-gate"

describe("needsTwoFactorEnrollment", () => {
  it("sends a password user who has not enrolled to the enrollment screen", () => {
    expect(
      needsTwoFactorEnrollment({
        companyRequires2fa: true,
        userHasTwoFactor: false,
        userHasPassword: true,
      })
    ).toBe(true)
  })

  // A password-less SSO account must not be parked on an enrollment form it can never pass.
  it("leaves a password-less SSO account alone instead of parking it on a form it cannot pass", () => {
    expect(
      needsTwoFactorEnrollment({
        companyRequires2fa: true,
        userHasTwoFactor: false,
        userHasPassword: false,
      })
    ).toBe(false)
  })

  it("stops asking once the user has enrolled", () => {
    expect(
      needsTwoFactorEnrollment({
        companyRequires2fa: true,
        userHasTwoFactor: true,
        userHasPassword: true,
      })
    ).toBe(false)
  })

  it("asks nothing of a company that does not require two-factor", () => {
    expect(
      needsTwoFactorEnrollment({
        companyRequires2fa: false,
        userHasTwoFactor: false,
        userHasPassword: true,
      })
    ).toBe(false)
  })
})

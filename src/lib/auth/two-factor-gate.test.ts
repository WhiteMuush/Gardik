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

  // The lockout this function exists for. A pre-provisioned SSO account has no
  // password credential, and the enrollment form asks for one to confirm
  // identity before it will hand out a TOTP secret. Redirecting such a user
  // parks them on a form they can never satisfy, while every other page bounces
  // them back to it. Their second factor belongs to the identity provider.
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

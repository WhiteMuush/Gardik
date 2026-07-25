import { test, expect } from "@playwright/test"
import { enrollTwoFactor, totpCode, setAllowedMethods, tryEnableTotp } from "./helpers/totp"
import { latestEmailOtp, trySendEmailOtp } from "./helpers/email-otp"

const EMAIL = "mfa@datashield.local"
const PASSWORD = "ChangeMe123!"
const ADMIN = { email: "admin@datashield.local", password: "ChangeMe123!" }

// Serial: both tests move the shared company policy, so they must not overlap.
// smoke.spec uses password-only admin login, which allowedAuthMethods does not
// gate, so it stays safe to run in parallel.
test.describe.configure({ mode: "serial" })

// Guards the "decorative policy" fix: enrolling a method the company has not
// allowed must be refused server-side, not merely hidden in the UI.
test("company can forbid a method it has not allowed", async ({ request }) => {
  await setAllowedMethods(request, ADMIN, ["EMAIL_OTP"])
  try {
    expect(await tryEnableTotp(request, EMAIL, PASSWORD)).toBe(403)
  } finally {
    await setAllowedMethods(request, ADMIN, ["TOTP"])
  }
})

// Guards the missing TwoFactor column regression: enrollment 500s and login can
// never be gated. The unit suite mocks Prisma, so only a real DB round-trip
// catches it.
test("2FA-enrolled user must pass a TOTP challenge to sign in", async ({ page, request }) => {
  const secret = await enrollTwoFactor(request, EMAIL, PASSWORD)

  await page.goto("/login")
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()

  // Password alone must not reach the dashboard; the TOTP form takes over.
  await expect(page.getByLabel("Authentication code")).toBeVisible()
  await expect(page).not.toHaveURL(/dashboard/)

  await page.getByLabel("Authentication code").fill(await totpCode(secret))
  await page.getByRole("button", { name: "Verify" }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()
})

// EMAIL_OTP is a second factor gated by the same policy: a company that does
// not allow it must get a 403 at the send step, the entry point of the flow.
// Runs after enrollment above, so the user already has 2FA enabled.
test("company can forbid EMAIL_OTP at the send step", async ({ request }) => {
  await setAllowedMethods(request, ADMIN, ["TOTP"])
  expect(await trySendEmailOtp(request, EMAIL, PASSWORD)).toBe(403)
})

// Full email-code challenge: with EMAIL_OTP allowed, a 2FA user can sign in via
// a code sent to their email instead of TOTP.
test("2FA user can complete the email-code challenge", async ({ page, request }) => {
  await setAllowedMethods(request, ADMIN, ["TOTP", "EMAIL_OTP"])
  try {
    await page.goto("/login")
    await page.getByLabel("Email").fill(EMAIL)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByLabel("Authentication code")).toBeVisible()
    await page.getByRole("button", { name: "Email me a code instead" }).click()
    await page.getByRole("button", { name: "Email me a code" }).click()

    await expect(page.getByLabel("Email code")).toBeVisible()
    await page.getByLabel("Email code").fill(await latestEmailOtp())
    await page.getByRole("button", { name: "Verify" }).click()

    await page.waitForURL("**/dashboard")
    await expect(page.getByRole("main")).toBeVisible()
  } finally {
    await setAllowedMethods(request, ADMIN, ["TOTP"])
  }
})

import { test, expect } from "@playwright/test"
import { enrollTwoFactor, totpCode, setAllowedMethods, tryEnableTotp } from "./helpers/totp"
import { latestEmailOtp, trySendEmailOtp } from "./helpers/email-otp"
import { resetTwoFactorEnrollment } from "./helpers/reset"

const EMAIL = "mfa@gardik.local"
const PASSWORD = "ChangeMe123!"
const ADMIN = { email: "admin@gardik.local", password: "ChangeMe123!" }

// Serial, since both tests move the shared company policy; the password-only smoke spec stays parallel-safe.
test.describe.configure({ mode: "serial" })

// Drops an earlier local enrollment, or enable returns 401; the serial chain then builds its own state.
test.beforeAll(async () => {
  await resetTwoFactorEnrollment(EMAIL)
})

// Enrolling a method the company has not allowed must be refused server-side, not merely hidden.
test("company can forbid a method it has not allowed", async ({ request }) => {
  await setAllowedMethods(request, ADMIN, ["EMAIL_OTP"])
  try {
    expect(await tryEnableTotp(request, EMAIL, PASSWORD)).toBe(403)
  } finally {
    await setAllowedMethods(request, ADMIN, ["TOTP"])
  }
})

// Only a real DB round-trip catches enrollment failing, since the unit suite mocks Prisma.
test("2FA-enrolled user must pass a TOTP challenge to sign in", async ({ page, request }) => {
  const secret = await enrollTwoFactor(request, EMAIL, PASSWORD)

  await page.goto("/login")
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  // Password alone must not reach the dashboard; the TOTP form takes over.
  await expect(page.getByLabel("Authentication code")).toBeVisible()
  await expect(page).not.toHaveURL(/dashboard/)

  await page.getByLabel("Authentication code").fill(await totpCode(secret))
  await page.getByRole("button", { name: "Verify" }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()
})

// A company without EMAIL_OTP must get a 403 at the send step; the user is already enrolled above.
test("company can forbid EMAIL_OTP at the send step", async ({ request }) => {
  await setAllowedMethods(request, ADMIN, ["TOTP"])
  expect(await trySendEmailOtp(request, EMAIL, PASSWORD)).toBe(403)
})

// With EMAIL_OTP allowed, a 2FA user can sign in with an emailed code instead of TOTP.
test("2FA user can complete the email-code challenge", async ({ page, request }) => {
  await setAllowedMethods(request, ADMIN, ["TOTP", "EMAIL_OTP"])
  try {
    await page.goto("/login")
    await page.getByLabel("Email").fill(EMAIL)
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()

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

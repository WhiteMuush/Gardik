import { test, expect } from "@playwright/test"
import { enrollTwoFactor, totpCode, setAllowedMethods, tryEnableTotp } from "./helpers/totp"

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

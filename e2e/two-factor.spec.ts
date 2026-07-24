import { test, expect } from "@playwright/test"
import { enrollTwoFactor, totpCode } from "./helpers/totp"

const EMAIL = "mfa@datashield.local"
const PASSWORD = "ChangeMe123!"

// Guards the regression where the TwoFactor model was missing columns the
// Better Auth plugin writes: enrollment 500s and login can never be gated.
// The unit suite mocks Prisma, so only a real DB round-trip catches it.
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

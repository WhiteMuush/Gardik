import { test, expect } from "@playwright/test"
import { setAllowedMethods } from "./helpers/totp"
import { addVirtualAuthenticator, tryGeneratePasskeyOptions } from "./helpers/passkey"
import { resetPasskeys, resetStepUp } from "./helpers/reset"

const PASSKEY_USER = { email: "passkey@gardik.local", password: "ChangeMe123!" }

// Serial, on its own company (passkey.gardik.dev) so it never races the two-factor spec on allowedAuthMethods.
test.describe.configure({ mode: "serial" })

// Drops credentials from an earlier local run, whose authenticator no longer exists and would hang sign-in.
test.beforeAll(async () => {
  await resetPasskeys(PASSKEY_USER.email)
  // The step-up grant outlives a test, so it is cleared or the form may not be there.
  await resetStepUp(PASSKEY_USER.email)
})

// With PASSKEY removed, the register-options endpoint must answer 403, not merely hide the card.
test("company can forbid passkey registration it has not allowed", async ({ request }) => {
  await setAllowedMethods(request, PASSKEY_USER, ["TOTP"])
  try {
    expect(await tryGeneratePasskeyOptions(request, PASSKEY_USER.email, PASSKEY_USER.password)).toBe(403)
  } finally {
    await setAllowedMethods(request, PASSKEY_USER, ["PASSKEY", "TOTP"])
  }
})

// Full WebAuthn round-trip: register a passkey, drop the session, sign back in with the passkey alone.
test("a registered passkey signs the user in", async ({ page, request }) => {
  await setAllowedMethods(request, PASSKEY_USER, ["PASSKEY", "TOTP"])
  await addVirtualAuthenticator(page)

  // Password sign-in (no 2FA on this user) to reach the setup page.
  await page.goto("/login")
  await page.getByLabel("Email").fill(PASSKEY_USER.email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill(PASSKEY_USER.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")

  // Registered from the account page, which stays reachable, after re-proving identity for its step-up.
  await page.goto("/security")
  await page.getByPlaceholder("Password").fill(PASSKEY_USER.password)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByPlaceholder("Name this device (optional)").fill("E2E Key")
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expect(page.getByText("E2E Key")).toBeVisible()

  // Drops the session but keeps the authenticator, which lives on the CDP target.
  await page.context().clearCookies()
  await page.goto("/login")
  await page.getByRole("button", { name: "Sign in with a passkey" }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()
})

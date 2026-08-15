import { test, expect } from "@playwright/test"
import { setAllowedMethods } from "./helpers/totp"
import { addVirtualAuthenticator, tryGeneratePasskeyOptions } from "./helpers/passkey"
import { resetPasskeys, resetStepUp } from "./helpers/reset"

const PASSKEY_USER = { email: "passkey@datashield.local", password: "ChangeMe123!" }

// Serial: both tests move the passkey company's policy. This spec uses its own
// company (passkey.datashield.dev, seeded in e2e/seed.ts), separate from the
// datashield.dev company the two-factor spec mutates, so the two files do not
// race on a shared allowedAuthMethods across workers.
test.describe.configure({ mode: "serial" })

// Drop credentials left by an earlier local run. They are bound to a virtual
// authenticator that no longer exists, so sign-in would hang waiting on a
// credential nothing can satisfy.
test.beforeAll(async () => {
  await resetPasskeys(PASSKEY_USER.email)
  // The account section sits behind a step-up whose grant outlives a single
  // test, so clear it or the form this spec fills may not be there at all.
  await resetStepUp(PASSKEY_USER.email)
})

// The policy gate must refuse passkey registration server-side, not merely hide
// the setup card: with PASSKEY removed, the register-options endpoint (a GET
// behind a fresh session) returns 403.
test("company can forbid passkey registration it has not allowed", async ({ request }) => {
  await setAllowedMethods(request, PASSKEY_USER, ["TOTP"])
  try {
    expect(await tryGeneratePasskeyOptions(request, PASSKEY_USER.email, PASSKEY_USER.password)).toBe(403)
  } finally {
    await setAllowedMethods(request, PASSKEY_USER, ["PASSKEY", "TOTP"])
  }
})

// Full WebAuthn round-trip against a CDP virtual authenticator: register a
// passkey from the setup page, drop the session, then sign back in with the
// passkey alone. Guards that enrollment persists a usable credential and that
// usernameless passkey sign-in reaches the dashboard.
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

  // Register a passkey from the account page, which stays reachable for the
  // life of the workspace (unlike the onboarding checklist). It sits behind a
  // step-up, so re-prove identity first.
  await page.goto("/security")
  await page.getByPlaceholder("Password").fill(PASSKEY_USER.password)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByPlaceholder("Name this device (optional)").fill("E2E Key")
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expect(page.getByText("E2E Key")).toBeVisible()

  // Drop the session, keep the authenticator (it lives on the CDP target), and
  // sign in with the passkey alone.
  await page.context().clearCookies()
  await page.goto("/login")
  await page.getByRole("button", { name: "Sign in with a passkey" }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()
})

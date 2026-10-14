import { test, expect } from "@playwright/test"

// Covers the client-side SSO escape hatch and anti-lockout recovery by intercepting /api/sso/resolve, without a real IdP.

// ssoExempt only matters if the password step is reachable without asking the server about SSO.
test("the anti-lockout escape hatch skips the SSO lookup entirely", async ({ page }) => {
  let resolveCalled = false
  await page.route("**/api/sso/resolve", async (route) => {
    resolveCalled = true
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sso: false }),
    })
  })

  await page.goto("/login")
  await page.getByLabel("Email").fill("exempt@gardik.local")
  await page.getByRole("button", { name: "Use a password instead" }).click()

  await expect(page.getByLabel("Password")).toBeVisible()
  expect(resolveCalled).toBe(false)
})

// Stalls resolve, then dispatches a persisted `pageshow`, since a real bfcache restore is unreliable under CDP.
test("the pageshow listener clears the pending state on a restore", async ({ page }) => {
  await page.route("**/api/sso/resolve", async () => {
    // Never settles, like a stalled network in production.
    await new Promise<void>(() => {})
  })

  await page.goto("/login")
  await page.getByLabel("Email").fill("stalled@gardik.local")
  await page.getByRole("button", { name: "Continue" }).click()

  const checking = page.getByRole("button", { name: "Checking..." })
  const escapeHatch = page.getByRole("button", { name: "Use a password instead" })
  await expect(checking).toBeDisabled()
  await expect(escapeHatch).toBeDisabled()

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })

  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled()
  await expect(escapeHatch).toBeEnabled()
})

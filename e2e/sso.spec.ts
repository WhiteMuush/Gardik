import { test, expect } from "@playwright/test"

// This spec covers the client-side SSO escape hatch on step one of login and
// the anti-lockout recovery added alongside it. It does not seed a real SSO
// provider (e2e/seed.ts has no SSO fixtures) and does not attempt a genuine
// identity-provider round trip: that is a separate, larger effort. Everything
// here is provable by intercepting /api/sso/resolve, which is exactly what
// the escape hatch is built to bypass.

// Guards the anti-lockout escape hatch itself: User.ssoExempt only matters if
// a user can reach the password step without ever asking the server whether
// their company runs SSO. If usePasswordInstead ever regresses into calling
// resolve first, this would start failing.
test("the anti-lockout escape hatch skips the SSO lookup entirely", async ({ page }) => {
  let resolveCalled = false
  await page.route("**/api/sso/resolve", async (route) => {
    resolveCalled = true
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sso: false }) })
  })

  await page.goto("/login")
  await page.getByLabel("Email").fill("exempt@datashield.local")
  await page.getByRole("button", { name: "Use a password instead" }).click()

  await expect(page.getByLabel("Password")).toBeVisible()
  expect(resolveCalled).toBe(false)
})

// Guards the bfcache-trap fix for Finding 1: a page restored from
// back-forward cache after a slow or broken IdP redirect must not leave
// Continue and the escape hatch permanently disabled. A real back-forward
// navigation is not exercised here: there is no SSO provider seeded to
// redirect to, and Chromium's bfcache eligibility under CDP-driven automation
// is not reliable enough to assert against. Instead this stalls the resolve
// call (mirroring the network-stall half of the same finding) to catch
// `pending` in the disabled state, then dispatches the same `pageshow`
// event with `persisted: true` that a genuine restore delivers, exercising
// the exact listener added to page.tsx.
test("pending state recovers from a bfcache-style restore", async ({ page }) => {
  await page.route("**/api/sso/resolve", async () => {
    // Never calls fulfill/continue/abort: the request hangs from the page's
    // point of view, same as a stalled network in production.
    await new Promise<void>(() => {})
  })

  await page.goto("/login")
  await page.getByLabel("Email").fill("stalled@datashield.local")
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

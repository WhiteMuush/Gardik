import { test, expect } from "@playwright/test"

let cspViolations: string[]
let pageErrors: string[]

test.beforeEach(({ page }) => {
  cspViolations = []
  pageErrors = []
  page.on("console", (msg) => {
    const text = msg.text()
    if (text.includes("Content Security Policy") || text.includes("Refused to")) {
      cspViolations.push(text)
    }
  })
  page.on("pageerror", (err) => {
    pageErrors.push(err.message)
  })
})

test.afterEach(() => {
  expect(cspViolations).toEqual([])
  expect(pageErrors).toEqual([])
})

test("admin signs in, sees dashboard and alerts", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@datashield.local")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()

  await page.goto("/alerts")
  await expect(page.getByRole("main")).toBeVisible()

  await page.goto("/dashboard/widgets")
  await expect(page.getByRole("heading", { name: "Widget Library" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Alert Severity" })).toBeVisible()
})

// Guards the reachability of the security settings. They used to live only on
// the onboarding checklist, which redirects away once a workspace has its first
// employee, leaving an admin no way to reach the SSO or auth-policy controls
// from the interface at all.
test("security settings are reachable from the sidebar", async ({ page }) => {
  // Scoped to the sidebar and exact: getByRole matches accessible names by
  // substring, and the dashboard carries other links whose text contains this
  // one.
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@datashield.local")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")

  await page.getByRole("navigation").getByRole("link", { name: "Security", exact: true }).click()
  await page.waitForURL("**/security")
  // level 2: the topbar renders the page name as an h1 as well.
  await expect(page.getByRole("heading", { name: "Security", exact: true, level: 2 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Single sign-on (OIDC)" })).toBeVisible()
})

import { test, expect } from "@playwright/test"
import { resetStepUp } from "./helpers/reset"

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
  await page.getByLabel("Email").fill("admin@gardik.local")
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

// The print-only copy of the report is hidden on screen, and a chart that measures a hidden box warns on every render.
test("reports page draws its charts without size warnings", async ({ page }) => {
  const chartWarnings: string[] = []
  page.on("console", (msg) => {
    if (msg.text().includes("of chart should be greater than 0")) chartWarnings.push(msg.text())
  })

  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@gardik.local")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")

  await page.goto("/reports")
  // The whole chart, since a line at zero has an empty box and never counts as visible.
  await expect(page.locator(".recharts-surface[role=application]").filter({ visible: true })).toBeVisible()
  expect(chartWarnings).toEqual([])
})

// Security settings must stay reachable from the sidebar once onboarding is over.
test("security settings are reachable from the sidebar", async ({ page }) => {
  // Another spec may have left a step-up grant that would bypass the gate.
  await resetStepUp("admin@gardik.local")

  // Scoped to the sidebar and exact, since getByRole matches names by substring.
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@gardik.local")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")

  await page.getByRole("link", { name: "My account", exact: true }).click()
  await page.waitForURL("**/security")

  // A live session is not enough to reach the section where a session becomes lasting access.
  await expect(page.getByRole("heading", { name: "Confirm it is you" })).toBeVisible()
  await page.getByPlaceholder("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("heading", { name: "Single sign-on (OIDC)" })).toBeVisible()
})

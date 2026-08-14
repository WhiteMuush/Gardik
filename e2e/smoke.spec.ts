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

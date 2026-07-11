import { test, expect } from "@playwright/test"

let cspViolations: string[]

test.beforeEach(({ page }) => {
  cspViolations = []
  page.on("console", (msg) => {
    const text = msg.text()
    if (text.includes("Content Security Policy") || text.includes("Refused to")) {
      cspViolations.push(text)
    }
  })
})

test.afterEach(() => {
  expect(cspViolations).toEqual([])
})

test("admin signs in, sees dashboard and alerts", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@datashield.local")
  await page.getByLabel("Password").fill("ChangeMe123!")
  await page.getByRole("button", { name: "Sign in" }).click()

  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("main")).toBeVisible()

  await page.goto("/alerts")
  await expect(page.getByRole("main")).toBeVisible()
})

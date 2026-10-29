import { test, expect, type Page } from "@playwright/test"

const MEMBER = { email: "member@gardik.local", password: "ChangeMe123!" }

async function signIn(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(MEMBER.email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill(MEMBER.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")
}

const saved = (page: Page, path: string) => page.waitForResponse((r) => r.url().includes(path) && r.ok())

// A theme and a saved alerts view both survive a reload, then go back to the defaults for the next run.
test("settings and saved views persist", async ({ page }) => {
  await signIn(page)

  await page.goto("/preferences")
  const theme = saved(page, "/api/account/preferences")
  await page.getByRole("radio", { name: "Dark" }).click()
  await theme
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")

  await page.goto("/alerts")
  const status = page.getByRole("combobox").filter({ hasText: "All statuses" })
  await status.selectOption("OPEN")
  const view = saved(page, "/api/account/views/alerts")
  await page.getByRole("button", { name: "Save as my default view" }).click()
  await view
  await page.reload()
  await expect(page.getByRole("combobox").filter({ hasText: "All statuses" })).toHaveValue("OPEN")

  expect((await page.request.patch("/api/account/preferences", { data: { theme: "system" } })).ok()).toBe(
    true
  )
  expect((await page.request.delete("/api/account/views/alerts")).ok()).toBe(true)
})

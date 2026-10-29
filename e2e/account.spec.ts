import { test, expect, type Page } from "@playwright/test"
import { resetStepUp } from "./helpers/reset"
import { auditActionsBy } from "./helpers/audit"

const MEMBER = { email: "member@gardik.local", password: "ChangeMe123!" }

async function signIn(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(MEMBER.email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill(MEMBER.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")
}

test.beforeAll(async () => {
  await resetStepUp(MEMBER.email)
})

// Renames through the step-up gate, then signs a second browser out from the first one.
test("a member manages their own account", async ({ page, browser }) => {
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signIn(otherPage)
  await signIn(page)

  await page.goto("/security")
  await expect(page.getByRole("heading", { name: "Confirm it is you" })).toBeVisible()
  await page.getByPlaceholder("Password").fill(MEMBER.password)
  await page.getByRole("button", { name: "Continue" }).click()

  const name = `Member ${Date.now()}`
  await page.getByPlaceholder("Your name").fill(name)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Saved")).toBeVisible()

  const sessions = page.locator("li").filter({ has: page.getByRole("button", { name: "Sign out" }) })
  await expect(page.getByText("This device")).toBeVisible()
  const before = await sessions.count()
  expect(before).toBeGreaterThan(0)
  await page.getByRole("button", { name: /Sign out all other sessions/ }).click()
  await expect(sessions).toHaveCount(0)

  // The other browser lost its session, so the dashboard sends it back to sign in.
  await otherPage.goto("/dashboard")
  await otherPage.waitForURL("**/login**")
  await other.close()

  const actions = await auditActionsBy(MEMBER.email)
  expect(actions).toContain("user.profile.update")
  expect(actions).toContain("user.session.revoke")
})

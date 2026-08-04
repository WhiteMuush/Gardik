import { test, expect } from "@playwright/test"

const ADMIN = { email: "admin@datashield.local", password: "ChangeMe123!" }
const MEMBER = { email: "member@datashield.local", password: "ChangeMe123!" }

test.describe.configure({ mode: "serial" })

async function login(page: import("@playwright/test").Page, u: { email: string; password: string }) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(u.email)
  await page.getByLabel("Password").fill(u.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")
}

// A Viewer (roles:read only, no roles:manage) can open Access and see roles but
// gets no "New role" mutation power server-side. Guards the read gate.
// Uses page.request, not the isolated request fixture, so the call carries the
// browser context cookies and reaches the permission check rather than 401.
test("a viewer can view roles but not create one", async ({ page }) => {
  await login(page, MEMBER)
  await page.goto("/access")
  await expect(page.getByRole("heading", { name: "Access management" })).toBeVisible()

  // Direct API create must be forbidden for a viewer.
  const res = await page.request.post("/api/roles", {
    headers: { "Content-Type": "application/json" },
    data: { name: "Sneaky", permissions: [] },
  })
  expect(res.status()).toBe(403)
})

// An admin creates a plain role through the UI. The crown-jewel step-up path is
// covered at the API level by the Task 8/9 integration tests.
// The name is unique per run and deleted afterwards: a fixed name would survive
// in the dev database and make a rerun pass on the leftover row while the POST
// silently returned 409.
test("admin creates a role through the management UI", async ({ page }) => {
  const roleName = `Playbook Author ${Date.now()}`
  await login(page, ADMIN)
  await page.goto("/access")

  await page.getByRole("button", { name: "New role" }).click()
  await page.getByPlaceholder("Role name").fill(roleName)
  await page.getByRole("checkbox").first().check()
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(roleName)).toBeVisible()

  const list = await (await page.request.get("/api/roles")).json()
  const created = (list.roles as { id: string; name: string }[]).find((r) => r.name === roleName)
  expect(created).toBeTruthy()
  const del = await page.request.delete(`/api/roles/${created!.id}`)
  expect(del.ok()).toBeTruthy()
})

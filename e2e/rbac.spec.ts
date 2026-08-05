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
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible()

  // Direct API create must be forbidden for a viewer.
  const res = await page.request.post("/api/roles", {
    headers: { "Content-Type": "application/json" },
    data: { name: "Sneaky", permissions: [] },
  })
  expect(res.status()).toBe(403)
})

// The dashboard shell is h-screen with overflow-hidden at every level, so each
// page owns its scrolling. Opening the permission editor makes /access taller
// than the viewport, and without a scroll container the Cancel button sits below
// the fold with no way to reach it: the panel cannot be closed.
test("the permission editor stays reachable once it overflows the viewport", async ({ page }) => {
  // Laptop height, not the 1280x720 default: the editor fits in 720 and the
  // clipping only shows up on a shorter viewport.
  await page.setViewportSize({ width: 1280, height: 620 })
  await login(page, ADMIN)
  await page.goto("/access")

  await page.getByRole("button", { name: "Edit" }).first().click()
  await expect(page.getByPlaceholder("Role name")).toBeVisible()

  // Walk out from the form and fail on any ancestor that clips content it is
  // too short to show. Asserting the Cancel button's position instead would
  // pass or fail on how many roles happen to be seeded, and Playwright can
  // force a click on a clipped node where a user cannot.
  const clipped = await page.evaluate(() => {
    let el: Element | null = document.querySelector('input[placeholder="Role name"]')
    const bad: string[] = []
    while (el && el !== document.documentElement) {
      const overflowY = getComputedStyle(el).overflowY
      if ((overflowY === "hidden" || overflowY === "clip") && el.scrollHeight > el.clientHeight + 1) {
        bad.push(`${el.tagName.toLowerCase()} clips ${el.scrollHeight}px into ${el.clientHeight}px`)
      }
      el = el.parentElement
    }
    return bad
  })
  expect(clipped).toEqual([])

  const cancel = page.getByRole("button", { name: "Cancel" })
  await cancel.scrollIntoViewIfNeeded()
  await cancel.click()
  await expect(page.getByPlaceholder("Role name")).toBeHidden()
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

import { test, expect } from "@playwright/test"

const ADMIN = { email: "admin@gardik.local", password: "ChangeMe123!" }
const MEMBER = { email: "member@gardik.local", password: "ChangeMe123!" }
const NARROW = { email: "narrow@gardik.local", password: "ChangeMe123!" }

test.describe.configure({ mode: "serial" })

async function login(page: import("@playwright/test").Page, u: { email: string; password: string }) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(u.email)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Password").fill(u.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL("**/dashboard")
}

// Typing a page's address must be refused, not only hidden from the rail.
test("a page the role cannot open refuses, and its rail entry is absent", async ({ page }) => {
  await login(page, NARROW)

  // Allowed: the two permissions this fixture holds.
  await page.goto("/alerts")
  await expect(page.getByRole("main")).toBeVisible()
  await expect(page.getByText("Not available to your role")).toBeHidden()

  for (const path of ["/data-api", "/employees", "/access", "/notifications"]) {
    await page.goto(path)
    await expect(page.getByText("Not available to your role")).toBeVisible()
  }

  // The refusal must come before the page queries, or the HTML still ships the data.
  await page.goto("/employees")
  expect(await page.content()).not.toContain("jane.doe@gardik.dev")

  const rail = page.getByRole("navigation")
  await expect(rail.getByRole("link", { name: "Alerts" })).toBeAttached()
  for (const label of ["Data API", "Employees", "Access", "Notifications"]) {
    await expect(rail.getByRole("link", { name: label, exact: true })).toHaveCount(0)
  }
})

// page.request carries the browser cookies, so the call reaches the permission check rather than a 401.
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

// The shell never scrolls, so the editor needs its own scroll container or Cancel is out of reach.
test("the permission editor stays reachable once it overflows the viewport", async ({ page }) => {
  // Laptop height, since the editor fits in the 720px default.
  await page.setViewportSize({ width: 1280, height: 620 })
  await login(page, ADMIN)
  await page.goto("/access")

  await page.getByRole("button", { name: "Edit" }).first().click()
  await expect(page.getByPlaceholder("Role name")).toBeVisible()

  // Fails on any ancestor clipping content, which unlike a button position does not depend on the seeded roles.
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

// A unique name deleted afterwards, so a rerun cannot pass on a leftover row while the POST returns 409.
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

// A Viewer opens these pages legitimately and must find no control leading to a refusal, checked against the admin case.
test("a read-only role is offered no control it cannot use", async ({ page }) => {
  await login(page, MEMBER)

  // reports:read without reports:export.
  await page.goto("/reports")
  await expect(page.getByRole("heading", { name: "Reports" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "CSV" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(0)

  // register:read without register:evidence.
  await page.goto("/register")
  await expect(page.getByText("E2E fixture exposure")).toBeVisible()
  await expect(page.getByTitle("Download evidence pack (CSV)")).toHaveCount(0)

  // dashboard:read without dashboard:customize.
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Customize" }).click()
  await expect(page.getByRole("link", { name: "Library" })).toHaveCount(0)

  // Without dashboard:manage_shared the button makes a personal preset directly, a real write this test accepts.
  await page.getByTitle("Add preset").click()
  await expect(page.getByText("Company preset")).toHaveCount(0)
})

test("an admin is offered the same controls, so the selectors above mean something", async ({ page }) => {
  await login(page, ADMIN)

  await page.goto("/reports")
  await expect(page.getByRole("button", { name: "CSV" })).toBeVisible()
  await expect(page.getByRole("link", { name: "PDF" })).toBeVisible()

  await page.goto("/register")
  await expect(page.getByTitle("Download evidence pack (CSV)").first()).toBeVisible()

  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Customize" }).click()
  await expect(page.getByRole("link", { name: "Library" })).toBeVisible()

  // With dashboard:manage_shared, the same button opens the scope menu instead of writing.
  await page.getByTitle("Add preset").click()
  await expect(page.getByText("Company preset")).toBeVisible()
})

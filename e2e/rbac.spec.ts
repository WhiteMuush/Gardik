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

// The hole this guards: pages used to check permissions only to decide what to
// draw, so typing the address reached them anyway and rendered the company's
// data to a role that was never granted it. The rail hiding the entry was the
// only thing in the way, and an address bar goes around that.
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

  // The refusal has to happen before the page queries, not after. Hiding a
  // rendered page still ships its data: with only the layout check in place,
  // this address was in the HTML of /employees for a role without
  // employees:read.
  await page.goto("/employees")
  expect(await page.content()).not.toContain("jane.doe@gardik.dev")

  const rail = page.getByRole("navigation")
  await expect(rail.getByRole("link", { name: "Alerts" })).toBeAttached()
  for (const label of ["Data API", "Employees", "Access", "Notifications"]) {
    await expect(rail.getByRole("link", { name: label, exact: true })).toHaveCount(0)
  }
})

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

// The other half of the rule the test above covers. That one proves the guard
// refuses the target; this one proves the interface stops offering the way in.
// A Viewer holds every ":read" permission and none of the actions, so it opens
// all three of these pages legitimately and must find no control on them that
// leads to a refusal. Each assertion is paired with the admin case, because a
// selector that matches nothing passes whether or not the code is right.
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
})

test("an admin is offered the same controls, so the selectors above mean something", async ({
  page,
}) => {
  await login(page, ADMIN)

  await page.goto("/reports")
  await expect(page.getByRole("button", { name: "CSV" })).toBeVisible()
  await expect(page.getByRole("link", { name: "PDF" })).toBeVisible()

  await page.goto("/register")
  await expect(page.getByTitle("Download evidence pack (CSV)").first()).toBeVisible()

  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Customize" }).click()
  await expect(page.getByRole("link", { name: "Library" })).toBeVisible()
})

import { describe, it, expect, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { routesFixture } from "@/lib/auth/invitation-routes.fixtures"
import { loadSavedViews } from "@/lib/preferences/load"

const mocks = vi.hoisted(() => ({
  stub: { user: {}, session: {} } as { user: Record<string, unknown>; session: Record<string, unknown> },
  email: { on: false, delivers: true },
  signedOut: false,
}))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (mocks.signedOut ? null : mocks.stub) }))

const { PUT: saveView, DELETE: resetView } = await import("@/app/api/account/views/[page]/route")

const { ctx, makeUser } = routesFixture("views", mocks)

const params = (page: string) => ({ params: Promise.resolve({ page }) })
const put = (body: unknown) =>
  new Request("http://localhost/api/account/views/x", { method: "PUT", body: JSON.stringify(body) })

async function actAs(label: string) {
  const user = await makeUser(label)
  mocks.signedOut = false
  mocks.stub.user = {
    id: user.id,
    companyId: ctx.companyId,
    roleId: ctx.viewerRoleId,
    twoFactorEnabled: false,
  }
  mocks.stub.session = { token: `views-${user.id}` }
  return user
}

describe("/api/account/views/[page]", () => {
  it("refuses without a session", async () => {
    mocks.signedOut = true
    expect((await saveView(put({ status: "OPEN" }), params("alerts"))).status).toBe(401)
    mocks.signedOut = false
  })

  it("answers 404 for a page that keeps no view", async () => {
    await actAs("views-unknown")
    expect((await saveView(put({ status: "OPEN" }), params("access"))).status).toBe(404)
  })

  it("saves each page on its own and resets one without touching the other", async () => {
    const user = await actAs("views-save")
    expect((await saveView(put({ status: "OPEN" }), params("alerts"))).status).toBe(200)
    expect((await saveView(put({ risk: "HIGH", sort: "risk:desc" }), params("employees"))).status).toBe(200)
    expect(await loadSavedViews(prisma, user.id)).toEqual({
      alerts: { status: "OPEN" },
      employees: { risk: "HIGH", sort: "risk:desc" },
    })

    expect((await resetView(new Request("http://localhost"), params("alerts"))).status).toBe(200)
    expect(await loadSavedViews(prisma, user.id)).toEqual({ employees: { risk: "HIGH", sort: "risk:desc" } })
  })

  it("refuses an invalid value", async () => {
    await actAs("views-invalid")
    expect((await saveView(put({ status: 42 }), params("alerts"))).status).toBe(400)
  })
})

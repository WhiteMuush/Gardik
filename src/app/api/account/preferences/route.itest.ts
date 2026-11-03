import { describe, it, expect, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { routesFixture } from "@/lib/auth/invitation-routes.fixtures"
import { loadPreferences } from "@/lib/preferences/load"
import { DEFAULT_PREFERENCES } from "@/lib/preferences/schema"

const mocks = vi.hoisted(() => ({
  stub: { user: {}, session: {} } as { user: Record<string, unknown>; session: Record<string, unknown> },
  email: { on: false, delivers: true },
  signedOut: false,
}))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (mocks.signedOut ? null : mocks.stub) }))

const { PATCH: savePreferences } = await import("@/app/api/account/preferences/route")

const { ctx, makeUser } = routesFixture("prefs", mocks)

function patch(body: unknown): Request {
  return new Request("http://localhost/api/account/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

async function actAs(label: string) {
  const user = await makeUser(label)
  mocks.signedOut = false
  mocks.stub.user = {
    id: user.id,
    companyId: ctx.companyId,
    roleId: ctx.viewerRoleId,
    twoFactorEnabled: false,
  }
  mocks.stub.session = { token: `prefs-${user.id}` }
  return user
}

describe("PATCH /api/account/preferences", () => {
  it("refuses without a session", async () => {
    mocks.signedOut = true
    expect((await savePreferences(patch({ theme: "dark" }))).status).toBe(401)
    mocks.signedOut = false
  })

  it("gives the defaults to a user who never saved anything", async () => {
    const user = await actAs("prefs-defaults")
    expect(await loadPreferences(prisma, user.id)).toEqual(DEFAULT_PREFERENCES)
  })

  it("saves one field at a time and keeps the others", async () => {
    const user = await actAs("prefs-merge")
    expect((await savePreferences(patch({ theme: "dark" }))).status).toBe(200)
    const res = await savePreferences(patch({ accent: "teal", colorblind: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "dark",
      accent: "teal",
      colorblind: true,
    })
    expect(await loadPreferences(prisma, user.id)).toMatchObject({ theme: "dark", accent: "teal" })
  })

  it("refuses an invalid value without writing anything", async () => {
    const user = await actAs("prefs-invalid")
    const res = await savePreferences(patch({ theme: "dark", textSize: "huge" }))
    expect(res.status).toBe(400)
    expect(await prisma.userPreference.findUnique({ where: { userId: user.id } })).toBeNull()
  })

  it("refuses a home page the role cannot open", async () => {
    await actAs("prefs-home")
    expect((await savePreferences(patch({ homePage: "/dashboard/widgets" }))).status).toBe(400)
    expect((await savePreferences(patch({ homePage: "/nowhere" }))).status).toBe(400)
    expect((await savePreferences(patch({ homePage: "/alerts" }))).status).toBe(200)
  })
})

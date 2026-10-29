import { describe, it, expect, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { grantStepUp } from "@/lib/rbac/step-up"
import { routesFixture } from "@/lib/auth/invitation-routes.fixtures"

const mocks = vi.hoisted(() => ({
  stub: { user: {}, session: {} } as { user: Record<string, unknown>; session: Record<string, unknown> },
  email: { on: false, delivers: true },
  signedOut: false,
}))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (mocks.signedOut ? null : mocks.stub) }))

const { PATCH: updateProfile } = await import("@/app/api/account/profile/route")

const { ctx, makeUser } = routesFixture("profile", mocks)

function patch(body: unknown): Request {
  return new Request("http://localhost/api/account/profile", { method: "PATCH", body: JSON.stringify(body) })
}

async function actAs(label: string, opts: { stepUp: boolean; name?: string }) {
  const user = await makeUser(label)
  await prisma.user.update({ where: { id: user.id }, data: { name: opts.name ?? "Old Name" } })
  if (opts.stepUp) await grantStepUp(prisma, user.id)
  mocks.signedOut = false
  mocks.stub.user = {
    id: user.id,
    companyId: ctx.companyId,
    roleId: ctx.viewerRoleId,
    twoFactorEnabled: false,
  }
  mocks.stub.session = { token: `profile-${user.id}`, ipAddress: "198.51.100.4" }
  return user
}

function rows(userId: string) {
  return prisma.auditLog.findMany({ where: { targetId: userId, action: AUDIT_ACTIONS.USER_PROFILE_UPDATE } })
}

describe("PATCH /api/account/profile", () => {
  it("refuses without a session", async () => {
    mocks.signedOut = true
    expect((await updateProfile(patch({ name: "Anyone" }))).status).toBe(401)
    mocks.signedOut = false
  })

  it("asks for a step-up first", async () => {
    const user = await actAs("profile-no-grant", { stepUp: false })
    const res = await updateProfile(patch({ name: "New Name" }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("Old Name")
  })

  it("refuses an empty or overlong name", async () => {
    await actAs("profile-bad", { stepUp: true })
    expect((await updateProfile(patch({ name: "   " }))).status).toBe(400)
    expect((await updateProfile(patch({ name: "x".repeat(101) }))).status).toBe(400)
    expect((await updateProfile(patch({}))).status).toBe(400)
  })

  it("renames the user and records before and after", async () => {
    const user = await actAs("profile-ok", { stepUp: true })

    expect((await updateProfile(patch({ name: "  New Name  " }))).status).toBe(200)

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("New Name")
    const audit = await rows(user.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]!.before).toEqual({ name: "Old Name" })
    expect(audit[0]!.after).toEqual({ name: "New Name" })
    expect(audit[0]!.ip).toBe("198.51.100.4")
  })

  it("writes nothing when the name is unchanged", async () => {
    const user = await actAs("profile-same", { stepUp: true, name: "Same Name" })
    expect((await updateProfile(patch({ name: "Same Name" }))).status).toBe(200)
    expect(await rows(user.id)).toHaveLength(0)
  })
})

import { describe, it, expect, vi } from "vitest"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { grantStepUp } from "@/lib/rbac/step-up"
import { post, routesFixture } from "@/lib/auth/invitation-routes.fixtures"

const mocks = vi.hoisted(() => ({ stub: { user: {}, session: {} }, email: { on: false, delivers: true } }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => mocks.stub }))

const { POST: changePassword } = await import("@/app/api/account/password/route")

const { ctx, makeUser } = routesFixture("self-password", mocks)

const OLD = "the-real-password-1"
const NEW = "chosen-fresh-password-1"

// A user with two live sessions, acting through the first one.
async function setUp(label: string, opts: { twoFactor: boolean; stepUp: boolean; rotation?: boolean }) {
  const user = await makeUser(label, { password: OLD })
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: opts.twoFactor, mustChangePassword: opts.rotation === true },
  })
  const kept = `kept-${user.id}`
  await prisma.session.createMany({
    data: [
      { userId: user.id, token: kept, expiresAt: new Date(Date.now() + 3_600_000) },
      { userId: user.id, token: `other-${user.id}`, expiresAt: new Date(Date.now() + 3_600_000) },
    ],
  })
  if (opts.stepUp) await grantStepUp(prisma, user.id)
  mocks.stub.user = {
    id: user.id,
    companyId: ctx.companyId,
    roleId: ctx.viewerRoleId,
    twoFactorEnabled: opts.twoFactor,
    mustChangePassword: opts.rotation === true,
  }
  mocks.stub.session = { token: kept, ipAddress: "203.0.113.7" }
  return { user, kept }
}

async function passwordIs(userId: string, password: string) {
  const account = await prisma.account.findFirstOrThrow({ where: { userId, providerId: "credential" } })
  return bcrypt.compare(password, account.password!)
}

function auditRows(userId: string) {
  return prisma.auditLog.findMany({ where: { targetId: userId, action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE } })
}

describe("POST /api/account/password, self-service", () => {
  it("changes the password with 2FA and a step-up, and records it without secrets", async () => {
    const { user, kept } = await setUp("self-ok", { twoFactor: true, stepUp: true })

    expect((await changePassword(post({ currentPassword: OLD, newPassword: NEW }))).status).toBe(200)

    expect(await passwordIs(user.id, NEW)).toBe(true)
    const sessions = await prisma.session.findMany({ where: { userId: user.id } })
    expect(sessions.map((s) => s.token)).toEqual([kept])

    const rows = await auditRows(user.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.after).toEqual({ reason: "self_service", otherSessionsRevoked: 1 })
    expect(rows[0]!.actorUserId).toBe(user.id)
    expect(rows[0]!.ip).toBe("203.0.113.7")
    const raw = JSON.stringify(rows[0])
    expect(raw).not.toContain(OLD)
    expect(raw).not.toContain(NEW)
    expect(raw).not.toContain(kept)
  })

  it("asks for a step-up when 2FA is on but no grant is held", async () => {
    const { user } = await setUp("self-no-grant", { twoFactor: true, stepUp: false })

    const res = await changePassword(post({ currentPassword: OLD, newPassword: NEW }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect(await passwordIs(user.id, OLD)).toBe(true)
    expect(await auditRows(user.id)).toHaveLength(0)
  })

  it("refuses an account without 2FA, so a stolen password cannot lock the owner out", async () => {
    const { user } = await setUp("self-no-2fa", { twoFactor: false, stepUp: true })

    const res = await changePassword(post({ currentPassword: OLD, newPassword: NEW }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/two-factor/i)
    expect(await passwordIs(user.id, OLD)).toBe(true)
  })

  it("still lets a forced rotation through without 2FA or step-up, and records it", async () => {
    const { user } = await setUp("rotation-audit", { twoFactor: false, stepUp: false, rotation: true })

    expect((await changePassword(post({ currentPassword: OLD, newPassword: NEW }))).status).toBe(200)

    const rows = await auditRows(user.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.after).toEqual({ reason: "rotation", otherSessionsRevoked: 1 })
  })
})

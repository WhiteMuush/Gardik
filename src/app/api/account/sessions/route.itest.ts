import { describe, it, expect, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { grantStepUp } from "@/lib/rbac/step-up"
import { params, routesFixture } from "@/lib/auth/invitation-routes.fixtures"

const mocks = vi.hoisted(() => ({ stub: { user: {}, session: {} }, email: { on: false, delivers: true } }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => mocks.stub }))

const { DELETE: revokeOne } = await import("@/app/api/account/sessions/[id]/route")
const { POST: revokeOthers } = await import("@/app/api/account/sessions/revoke-others/route")

const { ctx, makeUser } = routesFixture("sessions", mocks)

const del = () => new Request("http://localhost/api/account/sessions/x", { method: "DELETE" })

// A user with three live sessions, acting through the first one.
async function actAs(label: string, stepUp = true) {
  const user = await makeUser(label)
  const tokens = ["current", "laptop", "phone"].map((t) => `${t}-${user.id}`)
  const sessions = await Promise.all(
    tokens.map((token) =>
      prisma.session.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3_600_000) },
      })
    )
  )
  if (stepUp) await grantStepUp(prisma, user.id)
  mocks.stub.user = {
    id: user.id,
    companyId: ctx.companyId,
    roleId: ctx.viewerRoleId,
    twoFactorEnabled: false,
  }
  mocks.stub.session = { token: tokens[0], ipAddress: "192.0.2.9" }
  return { user, sessions, tokens }
}

function rows(actorUserId: string) {
  return prisma.auditLog.findMany({ where: { actorUserId, action: AUDIT_ACTIONS.USER_SESSION_REVOKE } })
}

describe("DELETE /api/account/sessions/[id]", () => {
  it("asks for a step-up first", async () => {
    const { sessions } = await actAs("one-no-grant", false)
    const res = await revokeOne(del(), params(sessions[1]!.id))
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect(await prisma.session.count({ where: { id: sessions[1]!.id } })).toBe(1)
  })

  it("answers 404 for a session of another user and leaves it alone", async () => {
    const other = await actAs("one-victim")
    const { user } = await actAs("one-attacker")
    expect((await revokeOne(del(), params(other.sessions[1]!.id))).status).toBe(404)
    expect(await prisma.session.count({ where: { id: other.sessions[1]!.id } })).toBe(1)
    expect(await rows(user.id)).toHaveLength(0)
  })

  it("refuses the current session, which signing out already covers", async () => {
    const { sessions } = await actAs("one-current")
    expect((await revokeOne(del(), params(sessions[0]!.id))).status).toBe(400)
  })

  it("deletes the session and records it by id, never by token", async () => {
    const { user, sessions, tokens } = await actAs("one-ok")

    expect((await revokeOne(del(), params(sessions[1]!.id))).status).toBe(200)

    expect(await prisma.session.count({ where: { id: sessions[1]!.id } })).toBe(0)
    const audit = await rows(user.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]!.targetType).toBe("Session")
    expect(audit[0]!.targetId).toBe(sessions[1]!.id)
    expect(audit[0]!.after).toEqual({ scope: "one" })
    expect(JSON.stringify(audit)).not.toContain(tokens[1]!)
  })
})

describe("POST /api/account/sessions/revoke-others", () => {
  it("asks for a step-up first", async () => {
    const { user } = await actAs("others-no-grant", false)
    expect((await (await revokeOthers()).json()).code).toBe("STEP_UP_REQUIRED")
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(3)
  })

  it("keeps only the current session and records how many went", async () => {
    const { user, tokens } = await actAs("others-ok")

    expect((await revokeOthers()).status).toBe(200)

    const left = await prisma.session.findMany({ where: { userId: user.id } })
    expect(left.map((s) => s.token)).toEqual([tokens[0]])
    const audit = await rows(user.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]!.after).toEqual({ scope: "others", count: 2 })
    expect(audit[0]!.ip).toBe("192.0.2.9")
  })
})

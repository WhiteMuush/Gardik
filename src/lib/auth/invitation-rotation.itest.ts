import { describe, it, expect, vi } from "vitest"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { params, post, routesFixture } from "./invitation-routes.fixtures"

const mocks = vi.hoisted(() => ({ stub: { user: {}, session: {} }, email: { on: false, delivers: true } }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => mocks.stub }))
vi.mock("@/lib/email", () => ({
  emailEnabled: () => mocks.email.on,
  sendInvitation: async () => mocks.email.delivers,
}))

const { POST: invite } = await import("@/app/api/users/[id]/invite/route")
const { POST: requireRotation } = await import("@/app/api/users/[id]/require-password-change/route")
const { POST: accept } = await import("@/app/api/invitations/accept/route")
const { POST: changePassword } = await import("@/app/api/account/password/route")

// Forced password rotation, invitation acceptance and the self-service password change.
const { ctx, makeUser } = routesFixture("rotation", mocks)

describe("POST /api/users/[id]/require-password-change", () => {
  it("flags the account and closes its sessions in one go", async () => {
    const target = await makeUser("rotate", { password: "old-password-here-1" })
    await prisma.session.create({
      data: {
        userId: target.id,
        token: `rotate-session-${ctx.suffix}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    })

    expect((await requireRotation(post(), params(target.id))).status).toBe(200)

    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } })
    expect(after.mustChangePassword).toBe(true)
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0)

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: target.id, action: AUDIT_ACTIONS.USER_PASSWORD_ROTATION_REQUIRED },
    })
    expect(audit).not.toBeNull()
  })

  it("refuses an account that has no password to rotate", async () => {
    const target = await makeUser("no-password")
    expect((await requireRotation(post(), params(target.id))).status).toBe(409)
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } })
    expect(after.mustChangePassword).toBe(false)
  })

  it("refuses a target in another company", async () => {
    const outsider = await makeUser("rotate-outsider", {
      companyId: ctx.otherCompanyId,
      password: "old-password-here-1",
    })
    expect((await requireRotation(post(), params(outsider.id))).status).toBe(404)
  })
})

describe("POST /api/invitations/accept", () => {
  it("activates the account once and refuses the replay", async () => {
    const target = await makeUser("accept")
    const body = await (await invite(post(), params(target.id))).json()
    const token = new URL(body.link).searchParams.get("token")!

    expect((await accept(post({ token, password: "picked-by-the-user-1" }))).status).toBe(200)
    expect((await accept(post({ token, password: "picked-by-the-user-2" }))).status).toBe(400)

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: target.id, providerId: "credential" },
    })
    expect(await bcrypt.compare("picked-by-the-user-1", account.password!)).toBe(true)
  })

  it("answers a made-up token exactly like a spent one", async () => {
    const target = await makeUser("oracle")
    const body = await (await invite(post(), params(target.id))).json()
    const token = new URL(body.link).searchParams.get("token")!
    await accept(post({ token, password: "picked-by-the-user-1" }))

    const spent = await accept(post({ token, password: "picked-by-the-user-1" }))
    const madeUp = await accept(post({ token: "totally-made-up", password: "picked-by-the-user-1" }))

    expect(spent.status).toBe(madeUp.status)
    expect(await spent.json()).toEqual(await madeUp.json())
  })

  it("stops repeated attempts against one token", async () => {
    const token = `brute-force-target-${ctx.suffix}`
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      statuses.push((await accept(post({ token, password: "guessing-a-password-1" }))).status)
    }
    expect(statuses).toContain(429)
  })
})

describe("POST /api/account/password", () => {
  // Every case but one runs with a rotation pending, because that is the only
  // state in which this endpoint does anything at all.
  async function actAs(userId: string, sessionToken: string, mustChangePassword = true) {
    mocks.stub.user = { id: userId, companyId: ctx.companyId, roleId: ctx.viewerRoleId, mustChangePassword }
    mocks.stub.session = { token: sessionToken }
  }

  it("refuses a change nobody asked for, so the rule is not merely a hidden form", async () => {
    const target = await makeUser("voluntary", { password: "the-real-password-1" })
    await actAs(target.id, `s0-${target.id}`, false)

    const res = await changePassword(
      post({ currentPassword: "the-real-password-1", newPassword: "self-service-password-1" })
    )
    expect(res.status).toBe(403)

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: target.id, providerId: "credential" },
    })
    expect(await bcrypt.compare("the-real-password-1", account.password!)).toBe(true)
  })

  it("refuses without the current password", async () => {
    const target = await makeUser("wrong-current", { password: "the-real-password-1" })
    await actAs(target.id, `s-${target.id}`)

    const res = await changePassword(post({ currentPassword: "not-it", newPassword: "brand-new-password-1" }))
    expect(res.status).toBe(403)

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: target.id, providerId: "credential" },
    })
    expect(await bcrypt.compare("the-real-password-1", account.password!)).toBe(true)
  })

  it("clears the forced rotation, keeps this session and drops the others", async () => {
    const target = await makeUser("rotates", { password: "the-real-password-1" })
    await prisma.user.update({ where: { id: target.id }, data: { mustChangePassword: true } })
    const keptToken = `kept-${target.id}`
    await prisma.session.createMany({
      data: [
        { userId: target.id, token: keptToken, expiresAt: new Date(Date.now() + 3_600_000) },
        { userId: target.id, token: `dropped-${target.id}`, expiresAt: new Date(Date.now() + 3_600_000) },
      ],
    })
    await actAs(target.id, keptToken)

    const res = await changePassword(
      post({ currentPassword: "the-real-password-1", newPassword: "chosen-fresh-password-1" })
    )
    expect(res.status).toBe(200)

    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } })
    expect(after.mustChangePassword).toBe(false)

    const sessions = await prisma.session.findMany({ where: { userId: target.id } })
    expect(sessions.map((s) => s.token)).toEqual([keptToken])
  })

  it("refuses a new password that fails the length rule", async () => {
    const target = await makeUser("weak-new", { password: "the-real-password-1" })
    await actAs(target.id, `s2-${target.id}`)

    expect(
      (await changePassword(post({ currentPassword: "the-real-password-1", newPassword: "short" }))).status
    ).toBe(400)
  })

  it("refuses reusing the password that is already set", async () => {
    const target = await makeUser("same-again", { password: "the-real-password-1" })
    await actAs(target.id, `s3-${target.id}`)

    expect(
      (
        await changePassword(
          post({ currentPassword: "the-real-password-1", newPassword: "the-real-password-1" })
        )
      ).status
    ).toBe(400)
  })
})

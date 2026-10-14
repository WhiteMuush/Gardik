import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { API_RATE_LIMIT, API_RATE_WINDOW_MS } from "@/lib/apiAuth"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { params, post, routesFixture } from "./invitation-routes.fixtures"

const mocks = vi.hoisted(() => ({ stub: { user: {}, session: {} }, email: { on: false, delivers: true } }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => mocks.stub }))
vi.mock("@/lib/email", () => ({
  emailEnabled: () => mocks.email.on,
  sendInvitation: async () => mocks.email.delivers,
}))

const { POST: invite } = await import("@/app/api/users/[id]/invite/route")

// Invite route authorization, plus the rate ceiling and rotation gate every route shares.
const { ctx, makeUser } = routesFixture("invite", mocks)

describe("POST /api/users/[id]/invite", () => {
  it("refuses a caller without users:manage", async () => {
    const target = await makeUser("perm")
    mocks.stub.user = { id: ctx.adminId, companyId: ctx.companyId, roleId: ctx.viewerRoleId }

    expect((await invite(post(), params(target.id))).status).toBe(403)
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
  })

  // Tenant isolation: an administrator cannot mint credentials for another company's user by id.
  it("refuses a target in another company, and says only 'not found'", async () => {
    const outsider = await makeUser("outsider", { companyId: ctx.otherCompanyId })

    const res = await invite(post(), params(outsider.id))
    expect(res.status).toBe(404)
    expect(await prisma.userInvitation.count({ where: { userId: outsider.id } })).toBe(0)
  })

  it("requires a fresh step-up before it will issue anything", async () => {
    const target = await makeUser("stepup")
    await prisma.stepUpGrant.deleteMany({ where: { userId: ctx.adminId } })

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
  })

  it("issues a link and records who invited whom", async () => {
    const target = await makeUser("issued")

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.link).toContain("/invite?token=")

    const stored = await prisma.userInvitation.findMany({ where: { userId: target.id } })
    expect(stored).toHaveLength(1)
    expect(stored[0].createdByUserId).toBe(ctx.adminId)
    expect(stored[0].consumedAt).toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: target.id, action: AUDIT_ACTIONS.USER_INVITE },
    })
    expect(audit?.actorUserId).toBe(ctx.adminId)
  })

  // Under mandatory SSO a password invitation would buy nothing yet still be worth stealing.
  it("refuses to create a password path the sign-in policy forbids", async () => {
    await prisma.company.update({ where: { id: ctx.companyId }, data: { ssoMandatory: true } })
    try {
      const target = await makeUser("sso-mandatory")
      expect((await invite(post(), params(target.id))).status).toBe(409)
      expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
    } finally {
      await prisma.company.update({ where: { id: ctx.companyId }, data: { ssoMandatory: false } })
    }
  })

  // An undelivered link would stay a live credential whose only copy sits in a log.
  it("voids the invitation when the email cannot be delivered", async () => {
    mocks.email.on = true
    mocks.email.delivers = false
    const target = await makeUser("undelivered")

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(502)

    const stored = await prisma.userInvitation.findMany({ where: { userId: target.id } })
    expect(stored).toHaveLength(1)
    expect(stored[0].consumedAt).not.toBeNull()
  })

  it("never returns the link when email is configured", async () => {
    mocks.email.on = true
    mocks.email.delivers = true
    const target = await makeUser("email-delivery")

    const body = await (await invite(post(), params(target.id))).json()
    expect(body.delivered).toBe("email")
    expect(body.link).toBeUndefined()
  })
})

// Checked through a real route, since what matters is that the guard consults the limiter; the counter is pre-filled.
describe("the API rate ceiling in requirePermission", () => {
  it("refuses once the account has spent its allowance", async () => {
    const target = await makeUser("flood")
    for (let i = 0; i < API_RATE_LIMIT; i++) {
      await rateLimit(`api:${ctx.adminId}`, API_RATE_LIMIT, API_RATE_WINDOW_MS)
    }

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(429)
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)

    // Leave the counter clean for whatever runs next in this file.
    await prisma.apiRateLimit.deleteMany({ where: { key: `api:${ctx.adminId}` } })
  })
})

// The API guard itself must refuse a forced rotation, since only the browser obeys a page redirect.
describe("the forced-rotation gate in requirePermission", () => {
  it("refuses an otherwise authorized call while a rotation is pending", async () => {
    const target = await makeUser("gate")
    mocks.stub.user = { ...mocks.stub.user, mustChangePassword: true }

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("PASSWORD_CHANGE_REQUIRED")
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
  })

  it("lets the same call through once the flag is cleared", async () => {
    const target = await makeUser("gate-cleared")
    mocks.stub.user = { ...mocks.stub.user, mustChangePassword: false }

    expect((await invite(post(), params(target.id))).status).toBe(200)
  })
})

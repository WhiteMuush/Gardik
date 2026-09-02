import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"
import { API_RATE_LIMIT, API_RATE_WINDOW_MS } from "@/lib/apiAuth"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { grantStepUp } from "@/lib/rbac/step-up"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { CREDENTIAL_ISSUER } from "@/lib/auth/account"

// Route-level behaviour of the invitation and forced-rotation endpoints. The
// unit and DB tests next door cover the token itself; what matters here is the
// authorization around it, which is where this kind of feature usually leaks.

const stub: { user: Record<string, unknown>; session: Record<string, unknown> } = {
  user: {},
  session: {},
}
vi.mock("@/lib/auth/session", () => ({ getSession: async () => stub }))

let emailOn = false
let emailDelivers = true
vi.mock("@/lib/email", () => ({
  emailEnabled: () => emailOn,
  sendInvitation: async () => emailDelivers,
}))

const { POST: invite } = await import("@/app/api/users/[id]/invite/route")
const { POST: requireRotation } = await import(
  "@/app/api/users/[id]/require-password-change/route"
)
const { POST: accept } = await import("@/app/api/invitations/accept/route")
const { POST: changePassword } = await import("@/app/api/account/password/route")

const suffix = Date.now()
let companyId = ""
let otherCompanyId = ""
let adminId = ""
let viewerRoleId = ""
let adminRoleId = ""

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function post(body?: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

async function makeUser(label: string, opts: { companyId?: string; password?: string } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `invite-route-${label}-${suffix}@test.local`,
      companyId: opts.companyId ?? companyId,
      emailVerified: false,
    },
  })
  if (opts.password) {
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        issuer: CREDENTIAL_ISSUER,
        userId: user.id,
        password: await bcrypt.hash(opts.password, 12),
      },
    })
  }
  return user
}

function actAsAdmin() {
  stub.user = { id: adminId, email: "admin@invite-routes", companyId, roleId: adminRoleId }
  stub.session = { token: `admin-session-${suffix}` }
}

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "Invite Routes Co", domain: `invite-routes-${suffix}.test` },
  })
  companyId = company.id
  await seedPresetsForCompany(prisma, companyId)
  viewerRoleId = await resolvePresetRoleId(prisma, companyId, "Viewer")
  adminRoleId = await resolvePresetRoleId(prisma, companyId, "Administrator")

  const other = await prisma.company.create({
    data: { name: "Invite Routes Other Co", domain: `invite-routes-other-${suffix}.test` },
  })
  otherCompanyId = other.id

  const admin = await prisma.user.create({
    data: {
      email: `invite-routes-admin-${suffix}@test.local`,
      companyId,
      roleId: adminRoleId,
      emailVerified: true,
    },
  })
  adminId = admin.id
})

afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } })
})

beforeEach(async () => {
  emailOn = false
  emailDelivers = true
  actAsAdmin()
  await prisma.stepUpGrant.deleteMany({ where: { userId: adminId } })
  await grantStepUp(prisma, adminId)
})

describe("POST /api/users/[id]/invite", () => {
  it("refuses a caller without users:manage", async () => {
    const target = await makeUser("perm")
    stub.user = { id: adminId, companyId, roleId: viewerRoleId }

    expect((await invite(post(), params(target.id))).status).toBe(403)
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
  })

  // Tenant isolation: an administrator of one company must not be able to mint
  // credentials for somebody else's user by passing their id.
  it("refuses a target in another company, and says only 'not found'", async () => {
    const outsider = await makeUser("outsider", { companyId: otherCompanyId })

    const res = await invite(post(), params(outsider.id))
    expect(res.status).toBe(404)
    expect(await prisma.userInvitation.count({ where: { userId: outsider.id } })).toBe(0)
  })

  it("requires a fresh step-up before it will issue anything", async () => {
    const target = await makeUser("stepup")
    await prisma.stepUpGrant.deleteMany({ where: { userId: adminId } })

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
    expect(stored[0].createdByUserId).toBe(adminId)
    expect(stored[0].consumedAt).toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: target.id, action: AUDIT_ACTIONS.USER_INVITE },
    })
    expect(audit?.actorUserId).toBe(adminId)
  })

  // A company that mandates SSO refuses password sign-in, so an invitation
  // would produce a live token that buys nothing but is still worth stealing.
  it("refuses to create a password path the sign-in policy forbids", async () => {
    await prisma.company.update({ where: { id: companyId }, data: { ssoMandatory: true } })
    try {
      const target = await makeUser("sso-mandatory")
      expect((await invite(post(), params(target.id))).status).toBe(409)
      expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
    } finally {
      await prisma.company.update({ where: { id: companyId }, data: { ssoMandatory: false } })
    }
  })

  // The link exists the moment it is issued. If the mail never leaves, leaving
  // it live means a working credential whose only copy sits in a log.
  it("voids the invitation when the email cannot be delivered", async () => {
    emailOn = true
    emailDelivers = false
    const target = await makeUser("undelivered")

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(502)

    const stored = await prisma.userInvitation.findMany({ where: { userId: target.id } })
    expect(stored).toHaveLength(1)
    expect(stored[0].consumedAt).not.toBeNull()
  })

  it("never returns the link when email is configured", async () => {
    emailOn = true
    emailDelivers = true
    const target = await makeUser("email-delivery")

    const body = await (await invite(post(), params(target.id))).json()
    expect(body.delivered).toBe("email")
    expect(body.link).toBeUndefined()
  })
})

// The ceiling that applies to every authenticated route, checked through a real
// one rather than against the limiter in isolation: what matters is that the
// guard consults it at all. The counter is filled directly instead of by making
// 120 requests, which would prove the same thing far more slowly.
describe("the API rate ceiling in requirePermission", () => {
  it("refuses once the account has spent its allowance", async () => {
    const target = await makeUser("flood")
    for (let i = 0; i < API_RATE_LIMIT; i++) {
      await rateLimit(`api:${adminId}`, API_RATE_LIMIT, API_RATE_WINDOW_MS)
    }

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(429)
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)

    // Leave the counter clean for whatever runs next in this file.
    await prisma.apiRateLimit.deleteMany({ where: { key: `api:${adminId}` } })
  })
})

// The heart of "server-side": a user under a forced rotation must be refused by
// the API guard itself, not merely redirected by a page. Otherwise the browser
// obeys and everything else (scripts, the mobile client, curl) does not.
describe("the forced-rotation gate in requirePermission", () => {
  it("refuses an otherwise authorized call while a rotation is pending", async () => {
    const target = await makeUser("gate")
    stub.user = { ...stub.user, mustChangePassword: true }

    const res = await invite(post(), params(target.id))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("PASSWORD_CHANGE_REQUIRED")
    expect(await prisma.userInvitation.count({ where: { userId: target.id } })).toBe(0)
  })

  it("lets the same call through once the flag is cleared", async () => {
    const target = await makeUser("gate-cleared")
    stub.user = { ...stub.user, mustChangePassword: false }

    expect((await invite(post(), params(target.id))).status).toBe(200)
  })
})

describe("POST /api/users/[id]/require-password-change", () => {
  it("flags the account and closes its sessions in one go", async () => {
    const target = await makeUser("rotate", { password: "old-password-here-1" })
    await prisma.session.create({
      data: {
        userId: target.id,
        token: `rotate-session-${suffix}`,
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
      companyId: otherCompanyId,
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
    const token = `brute-force-target-${suffix}`
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
    stub.user = { id: userId, companyId, roleId: viewerRoleId, mustChangePassword }
    stub.session = { token: sessionToken }
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
      (await changePassword(post({ currentPassword: "the-real-password-1", newPassword: "short" })))
        .status
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

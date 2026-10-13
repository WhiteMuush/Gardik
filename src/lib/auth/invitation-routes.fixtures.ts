import { beforeAll, afterAll, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { grantStepUp } from "@/lib/rbac/step-up"

export type RouteMocks = {
  stub: { user: Record<string, unknown>; session: Record<string, unknown> }
  email: { on: boolean; delivers: boolean }
}

export function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

export function post(body?: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

// Two throwaway companies and a stepped-up admin per suite, named after it so parallel suites never collide.
export function routesFixture(name: string, mocks: RouteMocks) {
  const ctx = {
    suffix: `${name}-${Date.now()}`,
    companyId: "",
    otherCompanyId: "",
    adminId: "",
    viewerRoleId: "",
    adminRoleId: "",
  }

  function actAsAdmin() {
    mocks.stub.user = {
      id: ctx.adminId,
      email: "admin@invite-routes",
      companyId: ctx.companyId,
      roleId: ctx.adminRoleId,
    }
    mocks.stub.session = { token: `admin-session-${ctx.suffix}` }
  }

  async function makeUser(label: string, opts: { companyId?: string; password?: string } = {}) {
    const user = await prisma.user.create({
      data: {
        email: `invite-route-${label}-${ctx.suffix}@test.local`,
        companyId: opts.companyId ?? ctx.companyId,
        emailVerified: false,
      },
    })
    if (opts.password) {
      await prisma.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: await bcrypt.hash(opts.password, 12),
        },
      })
    }
    return user
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: "Invite Routes Co", domain: `invite-routes-${ctx.suffix}.test` },
    })
    ctx.companyId = company.id
    await seedPresetsForCompany(prisma, ctx.companyId)
    ctx.viewerRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Viewer")
    ctx.adminRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Administrator")
    const other = await prisma.company.create({
      data: { name: "Invite Routes Other Co", domain: `invite-routes-other-${ctx.suffix}.test` },
    })
    ctx.otherCompanyId = other.id
    const admin = await prisma.user.create({
      data: {
        email: `invite-routes-admin-${ctx.suffix}@test.local`,
        companyId: ctx.companyId,
        roleId: ctx.adminRoleId,
        emailVerified: true,
      },
    })
    ctx.adminId = admin.id
  })

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: { in: [ctx.companyId, ctx.otherCompanyId] } } })
  })

  beforeEach(async () => {
    mocks.email.on = false
    mocks.email.delivers = true
    actAsAdmin()
    await prisma.stepUpGrant.deleteMany({ where: { userId: ctx.adminId } })
    await grantStepUp(prisma, ctx.adminId)
  })

  return { ctx, makeUser, actAsAdmin }
}

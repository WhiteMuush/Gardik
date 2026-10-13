import { beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

export type SessionStub = { user: Record<string, unknown> }

export function post(body: unknown): Request {
  return new Request("http://localhost/api/users", { method: "POST", body: JSON.stringify(body) })
}

// A throwaway company and admin per suite, since parallel suites must never touch the shared seeded admin.
export function userCreateFixture(name: string, stub: SessionStub) {
  const ctx = { companyId: "", viewerRoleId: "" }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: "User Create Co", domain: `user-create-${name}-${Date.now()}.test` },
    })
    ctx.companyId = company.id
    await seedPresetsForCompany(prisma, ctx.companyId)
    ctx.viewerRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Viewer")
    const administratorRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Administrator")
    // A plain row with no credential: the stubbed session only needs a real id for the audit foreign key.
    const admin = await prisma.user.create({
      data: {
        email: `user-create-${name}-admin-${Date.now()}@test.local`,
        companyId: ctx.companyId,
        roleId: administratorRoleId,
        emailVerified: true,
      },
    })
    stub.user = {
      id: admin.id,
      email: admin.email,
      companyId: ctx.companyId,
      roleId: administratorRoleId,
      twoFactorEnabled: true,
    }
  })

  // The admin, the created users and their audit rows all cascade with the company.
  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: ctx.companyId } })
  })

  return ctx
}

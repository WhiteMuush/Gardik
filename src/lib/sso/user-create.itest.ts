import { describe, it, expect, beforeAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

// The route runs behind requirePermission, which reads getSession() from
// @/lib/auth/session. An integration test has no cookie jar, so that module
// is mocked with a session stub whose id resolves to a real User row (the
// audit write's actorUserId FK needs one). Kept in its own file so the mock
// doesn't leak into sso.itest.ts.
const stub: { user: Record<string, unknown> } = { user: {} }
vi.mock("@/lib/auth/session", () => ({ getSession: async () => stub }))

const { POST: createUser } = await import("@/app/api/users/route")

let companyId = ""
let viewerRoleId = ""

beforeAll(async () => {
  // A dedicated throwaway company/admin rather than the shared seeded
  // admin@datashield.local: itest files run in parallel against one seeded
  // DB, and reading/depending on that shared row races other suites that
  // mutate it (see PR #144). This suite only needs a User row to exist for
  // the stubbed session's id (the audit write's actorUserId FK), so a plain
  // created row with no password/Account is enough; nothing here signs in
  // for real.
  const company = await prisma.company.create({
    data: { name: "User Create Co", domain: `user-create-${Date.now()}.test` },
  })
  companyId = company.id
  await seedPresetsForCompany(prisma, companyId)
  viewerRoleId = await resolvePresetRoleId(prisma, companyId, "Viewer")
  const administratorRoleId = await resolvePresetRoleId(prisma, companyId, "Administrator")

  const admin = await prisma.user.create({
    data: {
      email: `user-create-admin-${Date.now()}@test.local`,
      companyId,
      roleId: administratorRoleId,
      emailVerified: true,
    },
  })

  stub.user = {
    id: admin.id,
    email: admin.email,
    companyId,
    roleId: administratorRoleId,
    twoFactorEnabled: true,
  }
})

describe("POST /api/users", () => {
  it("creates a passwordless shell user with an audit trail", async () => {
    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email: "itest-shell@datashield.local", name: "Shell", roleId: viewerRoleId }),
      })
    )
    expect(res.status).toBe(201)

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: "itest-shell@datashield.local" },
      include: { accounts: true },
    })
    expect(created.companyId).toBe(companyId)
    expect(created.roleId).toBe(viewerRoleId)

    // The security property that matters: pre-provisioning creates no way to
    // authenticate locally. Assert it directly rather than assuming the
    // handler behaves -- a shell user that silently gained a credential row
    // would be an account an attacker could try to sign in against.
    expect(created.accounts).toHaveLength(0)
    expect(created.accounts.some((a) => a.providerId === "credential")).toBe(false)
    expect(created.accounts.some((a) => a.password)).toBe(false)
    expect(created.emailVerified).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: { action: "user.create", targetId: created.id },
    })
    expect(audit).not.toBeNull()

    await prisma.user.delete({ where: { id: created.id } })
  })

  it("refuses a non-assignable role in the caller's own company", async () => {
    const notAssignable = await prisma.role.create({
      data: { companyId, name: "itest-not-assignable", permissions: [], isAssignable: false },
    })
    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email: "itest-shell2@datashield.local", name: "Shell", roleId: notAssignable.id }),
      })
    )
    expect(res.status).toBe(400)
    await prisma.role.delete({ where: { id: notAssignable.id } })
  })

  it("refuses a role that belongs to another company (tenancy boundary)", async () => {
    // The route takes the company from the session, never the body. Prove
    // the role lookup is actually scoped to it: a role that is otherwise
    // perfectly valid (assignable) but lives in a different company must
    // still be rejected, not just non-assignable ones.
    const otherCompany = await prisma.company.create({
      data: { name: "User Create Other Co", domain: `user-create-other-${Date.now()}.test` },
    })
    await seedPresetsForCompany(prisma, otherCompany.id)
    const otherViewerRoleId = await resolvePresetRoleId(prisma, otherCompany.id, "Viewer")

    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email: "itest-shell3@datashield.local", name: "Shell", roleId: otherViewerRoleId }),
      })
    )
    expect(res.status).toBe(400)
    expect(
      await prisma.user.findUnique({ where: { email: "itest-shell3@datashield.local" } })
    ).toBeNull()

    await prisma.company.delete({ where: { id: otherCompany.id } })
  })
})

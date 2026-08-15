import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { grantStepUp } from "@/lib/rbac/step-up"
import type { AuditEntry } from "@/lib/rbac/audit"

// The route runs behind requirePermission, which reads getSession() from
// @/lib/auth/session. An integration test has no cookie jar, so that module
// is mocked with a session stub whose id resolves to a real User row (the
// audit write's actorUserId FK needs one). Kept in its own file so the mock
// doesn't leak into sso.itest.ts.
const stub: { user: Record<string, unknown> } = { user: {} }
vi.mock("@/lib/auth/session", () => ({ getSession: async () => stub }))

// A toggleable wrapper around the real writeAudit so one test can prove the
// create+audit transaction rolls back cleanly when the audit write fails.
// Wired through vi.mock (rather than replaced only inside that test) because
// the route imports writeAudit once at module load; every other test leaves
// auditShouldFail false and gets the real implementation.
let auditShouldFail = false
let lastAuditEntry: AuditEntry | null = null
vi.mock("@/lib/rbac/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/audit")>()
  const writeAudit: typeof actual.writeAudit = async (db, entry) => {
    lastAuditEntry = entry
    if (auditShouldFail) throw new Error("itest: simulated audit failure")
    return actual.writeAudit(db, entry)
  }
  return { ...actual, writeAudit }
})

// Narrow-avoidance helper: reading lastAuditEntry through a function (rather
// than the bare module variable) keeps TypeScript from treating a prior
// "lastAuditEntry = null" assignment in the same test as though it still
// held after the awaited call that the mock's closure reassigns it in.
function readLastAuditEntry(): AuditEntry | null {
  return lastAuditEntry
}

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

// Deleting the company is enough: the admin, every user the route creates
// under it, and the audit rows all cascade with it.
afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: companyId } })
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

  it("returns 409, not 500, for an email that already has an account", async () => {
    const email = `itest-shell-dup-${Date.now()}@datashield.local`
    const first = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name: "Shell", roleId: viewerRoleId }),
      })
    )
    expect(first.status).toBe(201)

    // Same email again: the pre-check (findUnique before create) is what
    // should catch this in the common case.
    const second = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name: "Shell again", roleId: viewerRoleId }),
      })
    )
    expect(second.status).toBe(409)

    expect(await prisma.user.findMany({ where: { email } })).toHaveLength(1)

    const created = await prisma.user.findUniqueOrThrow({ where: { email } })
    await prisma.user.delete({ where: { id: created.id } })
  })

  it("still returns 409, not 500, when the pre-check races and the create hits the DB's unique constraint", async () => {
    // Simulates the TOCTOU window from the finding: two requests both pass
    // the findUnique pre-check because neither has committed yet. Force that
    // by making findUnique lie (report "no existing row") once a duplicate
    // is already sitting in the DB, so this request falls through to
    // prisma.user.create -- which must hit the real unique constraint on
    // User.email and have its P2002 caught and turned into a 409, not an
    // unhandled 500.
    const email = `itest-shell-race-${Date.now()}@datashield.local`
    const existing = await prisma.user.create({
      data: { email, name: "Already here", companyId, roleId: viewerRoleId, emailVerified: false },
    })

    const spy = vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null)
    try {
      const res = await createUser(
        new Request("http://localhost/api/users", {
          method: "POST",
          body: JSON.stringify({ email, name: "Racer", roleId: viewerRoleId }),
        })
      )
      expect(res.status).toBe(409)
    } finally {
      spy.mockRestore()
    }

    // No second row, and no orphan audit entry from the losing attempt.
    expect(await prisma.user.findMany({ where: { email } })).toHaveLength(1)
    const audits = await prisma.auditLog.findMany({ where: { targetId: existing.id } })
    expect(audits).toHaveLength(0)

    await prisma.user.delete({ where: { id: existing.id } })
  })

  it("rolls back the user row when the audit write fails inside the transaction", async () => {
    // Proves Finding 2's atomicity: if writeAudit throws after tx.user.create
    // has run (but before the transaction commits), Prisma must roll the
    // whole transaction back, leaving neither the user row nor an audit row
    // behind. Forced via the writeAudit wrapper mocked in above.
    const email = `itest-shell-rollback-${Date.now()}@datashield.local`
    auditShouldFail = true
    lastAuditEntry = null
    try {
      await expect(
        createUser(
          new Request("http://localhost/api/users", {
            method: "POST",
            body: JSON.stringify({ email, name: "Shell", roleId: viewerRoleId }),
          })
        )
      ).rejects.toThrow("itest: simulated audit failure")
    } finally {
      auditShouldFail = false
    }

    // writeAudit was reached (proving tx.user.create ran before the throw),
    // and it saw the would-be user's id.
    const targetId = readLastAuditEntry()?.targetId
    expect(targetId).toBeTruthy()

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
    if (targetId) {
      expect(await prisma.user.findUnique({ where: { id: targetId } })).toBeNull()
      expect(await prisma.auditLog.findFirst({ where: { targetId } })).toBeNull()
    }
  })
})

// The escalation hole this route used to have: it accepted any assignable role
// of the company, so a holder of users:manage could create an account carrying
// Administrator and then take it over through the invitation flow. The
// reassignment route refused the same grant; this one did not check at all.
describe("POST /api/users, no-escalation", () => {
  it("refuses a role holding permissions the actor lacks", async () => {
    const managerRoleId = await resolvePresetRoleId(prisma, companyId, "Security Manager")
    const administratorRoleId = await resolvePresetRoleId(prisma, companyId, "Administrator")
    const previous = stub.user
    stub.user = { ...previous, roleId: managerRoleId }
    try {
      const email = `itest-escalation-${Date.now()}@datashield.local`
      const res = await createUser(
        new Request("http://localhost/api/users", {
          method: "POST",
          body: JSON.stringify({ email, name: "Puppet", roleId: administratorRoleId }),
        })
      )

      expect(res.status).toBe(403)
      expect((await res.json()).excess.length).toBeGreaterThan(0)
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
    } finally {
      stub.user = previous
    }
  })

  // Crown-jewel roles need proof the session is still in the right hands, the
  // same bar the reassignment route applies.
  it("requires a fresh step-up for a role that carries a crown jewel", async () => {
    const administratorRoleId = await resolvePresetRoleId(prisma, companyId, "Administrator")
    const actorId = stub.user.id as string
    await prisma.stepUpGrant.deleteMany({ where: { userId: actorId } })

    const email = `itest-crownjewel-${Date.now()}@datashield.local`
    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name: "Second admin", roleId: administratorRoleId }),
      })
    )

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()

    // With the grant in place the same call goes through, so the test proves a
    // gate rather than a blanket refusal.
    await grantStepUp(prisma, actorId)
    const allowed = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email, name: "Second admin", roleId: administratorRoleId }),
      })
    )
    expect(allowed.status).toBe(201)
  })
})

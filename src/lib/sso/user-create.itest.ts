import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import type { AuditEntry } from "@/lib/rbac/audit"
import { post, userCreateFixture } from "./user-create.fixtures"

// No cookie jar in an integration test, so the session is a stub whose id is a real user.
const session = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }))

// Wraps the real writeAudit so one test can make it fail; the route binds writeAudit at load, hence vi.mock.
const audit = vi.hoisted(() => ({ fail: false, last: null as AuditEntry | null }))
vi.mock("@/lib/rbac/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/audit")>()
  const writeAudit: typeof actual.writeAudit = async (db, entry) => {
    audit.last = entry
    if (audit.fail) throw new Error("itest: simulated audit failure")
    return actual.writeAudit(db, entry)
  }
  return { ...actual, writeAudit }
})

// Read through a function, so TypeScript does not keep a stale narrowing across the awaited call.
const lastAudit = () => audit.last

const { POST: createUser } = await import("@/app/api/users/route")
const ctx = userCreateFixture("create", session)

describe("POST /api/users", () => {
  it("creates a passwordless shell user with an audit trail", async () => {
    const res = await createUser(
      post({ email: "itest-shell@gardik.local", name: "Shell", roleId: ctx.viewerRoleId })
    )
    expect(res.status).toBe(201)

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: "itest-shell@gardik.local" },
      include: { accounts: true },
    })
    expect(created.companyId).toBe(ctx.companyId)
    expect(created.roleId).toBe(ctx.viewerRoleId)

    // Pre-provisioning must create no local credential, or the shell user could be signed in against.
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
      data: { companyId: ctx.companyId, name: "itest-not-assignable", permissions: [], isAssignable: false },
    })
    const res = await createUser(
      post({ email: "itest-shell2@gardik.local", name: "Shell", roleId: notAssignable.id })
    )
    expect(res.status).toBe(400)
    await prisma.role.delete({ where: { id: notAssignable.id } })
  })

  it("refuses a role that belongs to another company (tenancy boundary)", async () => {
    // An assignable role from another company must still be refused, proving the lookup is scoped.
    const otherCompany = await prisma.company.create({
      data: { name: "User Create Other Co", domain: `user-create-other-${Date.now()}.test` },
    })
    await seedPresetsForCompany(prisma, otherCompany.id)
    const otherViewerRoleId = await resolvePresetRoleId(prisma, otherCompany.id, "Viewer")

    const res = await createUser(
      post({
        email: "itest-shell3@gardik.local",
        name: "Shell",
        roleId: otherViewerRoleId,
      })
    )
    expect(res.status).toBe(400)
    expect(await prisma.user.findUnique({ where: { email: "itest-shell3@gardik.local" } })).toBeNull()

    await prisma.company.delete({ where: { id: otherCompany.id } })
  })

  it("returns 409, not 500, for an email that already has an account", async () => {
    const email = `itest-shell-dup-${Date.now()}@gardik.local`
    const first = await createUser(post({ email, name: "Shell", roleId: ctx.viewerRoleId }))
    expect(first.status).toBe(201)

    // The findUnique pre-check catches the common duplicate.
    const second = await createUser(post({ email, name: "Shell again", roleId: ctx.viewerRoleId }))
    expect(second.status).toBe(409)

    expect(await prisma.user.findMany({ where: { email } })).toHaveLength(1)

    const created = await prisma.user.findUniqueOrThrow({ where: { email } })
    await prisma.user.delete({ where: { id: created.id } })
  })

  it("still returns 409, not 500, when the pre-check races and the create hits the DB's unique constraint", async () => {
    // Both racers pass the pre-check, so the unique constraint must fire and its P2002 become a 409.
    const email = `itest-shell-race-${Date.now()}@gardik.local`
    const existing = await prisma.user.create({
      data: {
        email,
        name: "Already here",
        companyId: ctx.companyId,
        roleId: ctx.viewerRoleId,
        emailVerified: false,
      },
    })

    const spy = vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null)
    try {
      const res = await createUser(post({ email, name: "Racer", roleId: ctx.viewerRoleId }))
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
    // An audit failure after the create must roll the whole transaction back.
    const email = `itest-shell-rollback-${Date.now()}@gardik.local`
    audit.fail = true
    audit.last = null
    try {
      await expect(createUser(post({ email, name: "Shell", roleId: ctx.viewerRoleId }))).rejects.toThrow(
        "itest: simulated audit failure"
      )
    } finally {
      audit.fail = false
    }

    // The audit write was reached, so the create did run before the rollback.
    const targetId = lastAudit()?.targetId
    expect(targetId).toBeTruthy()

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
    if (targetId) {
      expect(await prisma.user.findUnique({ where: { id: targetId } })).toBeNull()
      expect(await prisma.auditLog.findFirst({ where: { targetId } })).toBeNull()
    }
  })
})

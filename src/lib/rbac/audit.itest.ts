import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "./audit"

let companyId: string

beforeAll(async () => {
  const c = await prisma.company.create({
    data: { name: "Audit Test Co", domain: `audit-${Date.now()}.test` },
  })
  companyId = c.id
})

// Deleting the company is enough: every row this suite creates hangs off it
// through an onDelete: Cascade relation.
afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe("writeAudit (real DB)", () => {
  it("appends an entry with before/after snapshots", async () => {
    await writeAudit(prisma, {
      companyId,
      actorUserId: null,
      action: AUDIT_ACTIONS.ROLE_UPDATE,
      targetType: "Role",
      targetId: "role_x",
      before: { permissions: ["alerts:read"] },
      after: { permissions: ["alerts:read", "alerts:assign"] },
      ip: "127.0.0.1",
    })
    const rows = await prisma.auditLog.findMany({ where: { companyId } })
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe("role.update")
    expect((rows[0].after as { permissions: string[] }).permissions).toContain("alerts:assign")
  })
})

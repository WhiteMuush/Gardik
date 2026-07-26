import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

describe("audit read (real DB)", () => {
  it("returns entries newest first, scoped to the company", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    await writeAudit(prisma, {
      companyId: admin.companyId,
      actorUserId: admin.id,
      action: AUDIT_ACTIONS.ROLE_CREATE,
      targetType: "Role",
      targetId: "probe",
      after: { name: "Probe" },
    })
    const rows = await prisma.auditLog.findMany({
      where: { companyId: admin.companyId },
      orderBy: { createdAt: "desc" },
      take: 1,
    })
    expect(rows[0].targetId).toBe("probe")
  })
})

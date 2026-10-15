import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { grantStepUp } from "@/lib/rbac/step-up"
import { post, userCreateFixture } from "./user-create.fixtures"

const session = vi.hoisted(() => ({ user: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }))

const { POST: createUser } = await import("@/app/api/users/route")
const ctx = userCreateFixture("escalation", session)

// Creating a user must not grant a role carrying permissions the actor lacks, as the reassignment route already refused.
describe("POST /api/users, no-escalation", () => {
  it("refuses a role holding permissions the actor lacks", async () => {
    const managerRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Security Manager")
    const administratorRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Administrator")
    const previous = session.user
    session.user = { ...previous, roleId: managerRoleId }
    try {
      const email = `itest-escalation-${Date.now()}@gardik.local`
      const res = await createUser(post({ email, name: "Puppet", roleId: administratorRoleId }))

      expect(res.status).toBe(403)
      expect((await res.json()).excess.length).toBeGreaterThan(0)
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
    } finally {
      session.user = previous
    }
  })

  // A crown-jewel role needs a fresh step-up, the same bar as reassignment.
  it("requires a fresh step-up for a role that carries a crown jewel", async () => {
    const administratorRoleId = await resolvePresetRoleId(prisma, ctx.companyId, "Administrator")
    const actorId = session.user.id as string
    await prisma.stepUpGrant.deleteMany({ where: { userId: actorId } })

    const email = `itest-crownjewel-${Date.now()}@gardik.local`
    const res = await createUser(post({ email, name: "Second admin", roleId: administratorRoleId }))

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("STEP_UP_REQUIRED")
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()

    // With the grant the same call succeeds, so this is a gate and not a blanket refusal.
    await grantStepUp(prisma, actorId)
    const allowed = await createUser(post({ email, name: "Second admin", roleId: administratorRoleId }))
    expect(allowed.status).toBe(201)
  })
})

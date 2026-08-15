import { describe, it, expect } from "vitest"
import { hasValidStepUp } from "@/lib/rbac/step-up"
import { prisma } from "@/lib/prisma"

// verifyPassword/grantStepUp are covered against the DB in step-up.itest.ts; here
// we assert the wiring contract the route depends on: a fresh grant reads back as
// valid for the seeded admin. (The HTTP handler is exercised end-to-end by the
// e2e suite in a later task.)
describe("step-up route wiring (real DB)", () => {
  it("a minted grant is observable via hasValidStepUp", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@datashield.local" },
    })
    await prisma.stepUpGrant.create({
      data: { userId: admin.id, expiresAt: new Date(Date.now() + 60_000) },
    })
    expect(await hasValidStepUp(prisma, admin.id)).toBe(true)
  })
})

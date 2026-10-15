import { describe, it, expect } from "vitest"
import { hasValidStepUp } from "@/lib/rbac/step-up"
import { prisma } from "@/lib/prisma"

// Checks the wiring contract: a fresh grant reads back as valid for the seeded admin.
describe("step-up route wiring (real DB)", () => {
  it("a minted grant is observable via hasValidStepUp", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@gardik.local" },
    })
    await prisma.stepUpGrant.create({
      data: { userId: admin.id, expiresAt: new Date(Date.now() + 60_000) },
    })
    expect(await hasValidStepUp(prisma, admin.id)).toBe(true)
  })
})

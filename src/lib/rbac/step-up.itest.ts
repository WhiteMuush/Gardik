import { describe, it, expect, beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { verifyPassword, grantStepUp, hasValidStepUp } from "./step-up"

let userId: string
let companyId: string

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "StepUp Co", domain: `stepup-${Date.now()}.test` },
  })
  companyId = company.id
  const user = await prisma.user.create({
    data: { email: `stepup-${Date.now()}@test.local`, companyId: company.id },
  })
  userId = user.id
  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await bcrypt.hash("CorrectHorse1!", 10),
    },
  })
})

// Deleting the company is enough: the user, its credential account and any
// step-up grant cascade with it.
afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe("step-up grants (real DB)", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    expect(await verifyPassword(prisma, userId, "CorrectHorse1!")).toBe(true)
    expect(await verifyPassword(prisma, userId, "nope")).toBe(false)
  })

  it("reports a valid grant only after one is created", async () => {
    expect(await hasValidStepUp(prisma, userId)).toBe(false)
    await grantStepUp(prisma, userId)
    expect(await hasValidStepUp(prisma, userId)).toBe(true)
  })
})

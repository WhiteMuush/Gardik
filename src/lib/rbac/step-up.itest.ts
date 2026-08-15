import { describe, it, expect, beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { verifyPassword, grantStepUp, hasValidStepUp } from "./step-up"
import { MIN_VERIFY_MS } from "@/lib/auth/password-timing"

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

  // An account with no password used to be refused in a millisecond while a
  // wrong password cost a quarter of a second. That gap is measurable from
  // outside and answers a question nobody asked: which addresses are worth
  // attacking. Both paths now cost the same.
  it("refuses a password-less account no faster than a wrong password", async () => {
    const ssoOnly = await prisma.user.create({
      data: { email: `stepup-sso-${Date.now()}@test.local`, companyId },
    })

    const wrongStart = Date.now()
    expect(await verifyPassword(prisma, userId, "definitely-not-it")).toBe(false)
    const wrong = Date.now() - wrongStart

    const noPasswordStart = Date.now()
    expect(await verifyPassword(prisma, ssoOnly.id, "definitely-not-it")).toBe(false)
    const noPassword = Date.now() - noPasswordStart

    expect(noPassword).toBeGreaterThanOrEqual(MIN_VERIFY_MS - 20)
    expect(wrong).toBeGreaterThanOrEqual(MIN_VERIFY_MS - 20)
    // Same order of magnitude rather than a stopwatch reading: the property is
    // that neither answer stands out, not that they match to the millisecond.
    expect(Math.abs(noPassword - wrong)).toBeLessThan(MIN_VERIFY_MS)
  })

  it("reports a valid grant only after one is created", async () => {
    expect(await hasValidStepUp(prisma, userId)).toBe(false)
    await grantStepUp(prisma, userId)
    expect(await hasValidStepUp(prisma, userId)).toBe(true)
  })
})

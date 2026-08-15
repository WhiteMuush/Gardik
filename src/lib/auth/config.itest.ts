import { describe, it, expect, beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { convertSetCookieToCookie } from "better-auth/test"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"

// Covers two settings whose absence leaves no trace in this codebase, because
// the wrong behaviour is the library's default rather than anything written
// here: public signup being open, and the TOTP issuer falling back to Better
// Auth's own name.
//
// Throwaway company and user, never the shared seeded admin: itest files run
// in parallel against one seeded DB and signing in as that row races the
// suites that mutate it.

const suffix = Date.now()
const password = "itest-config-password-1"
const email = `auth-config-${suffix}@test.local`
const unknownEmail = `auth-config-signup-${suffix}@test.local`

let companyId = ""
let userId = ""

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "Auth Config Co", domain: `auth-config-${suffix}.test` },
  })
  companyId = company.id

  const user = await prisma.user.create({
    data: { email, companyId, emailVerified: true },
  })
  userId = user.id

  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await bcrypt.hash(password, 12),
    },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe("auth configuration", () => {
  it("refuses public signup outright", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: unknownEmail, password, name: "Uninvited" },
      })
    ).rejects.toThrow()

    expect(await prisma.user.count({ where: { email: unknownEmail } })).toBe(0)
  })

  it("issues TOTP enrollment under the product name, not the library's", async () => {
    const signIn = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    })
    const headers = convertSetCookieToCookie(signIn.headers)

    const { totpURI } = await auth.api.enableTwoFactor({ body: { password }, headers })

    // otpauth://totp/<issuer>:<account>?...&issuer=<issuer>
    expect(totpURI).toContain("DataShield")
    expect(totpURI).not.toContain("Better%20Auth")
    expect(totpURI).toContain(encodeURIComponent(email))
  })
})

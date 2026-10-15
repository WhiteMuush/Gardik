import { beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// A throwaway company and inviter per suite, named after it so parallel suites never collide.
export function invitationFixture(name: string) {
  const ctx = { suffix: `${name}-${Date.now()}`, companyId: "", inviterId: "" }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: "Invitation Co", domain: `invitation-${ctx.suffix}.test` },
    })
    ctx.companyId = company.id
    const inviter = await prisma.user.create({
      data: { email: `invite-actor-${ctx.suffix}@test.local`, companyId: ctx.companyId, emailVerified: true },
    })
    ctx.inviterId = inviter.id
  })

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: ctx.companyId } })
  })

  async function makeUser(label: string, opts: { withPassword?: boolean } = {}) {
    const user = await prisma.user.create({
      data: {
        email: `invite-${label}-${ctx.suffix}@test.local`,
        companyId: ctx.companyId,
        emailVerified: false,
      },
    })
    if (opts.withPassword) {
      await prisma.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: await bcrypt.hash("old-password-that-works", 12),
        },
      })
    }
    return user
  }

  return { ctx, makeUser }
}

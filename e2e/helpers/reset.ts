import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// The auth specs build state they cannot undo from the outside: enrolling a
// second factor writes a TwoFactor row, registering a passkey writes a credential
// bound to a CDP virtual authenticator that dies with the browser. CI never
// notices, its database is created fresh per run, but a local database keeps the
// leftovers and the next run fails: enable returns 401 on an already-enrolled
// user, and passkey sign-in hangs waiting for a credential no live authenticator
// holds.
//
// These run in beforeAll rather than a teardown on purpose. A crashed or
// interrupted run never reaches its teardown, so cleaning up front is what
// actually makes a rerun deterministic.

async function withPrisma<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  try {
    return await fn(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

export async function resetTwoFactorEnrollment(email: string): Promise<void> {
  await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) return
    await prisma.twoFactor.deleteMany({ where: { userId: user.id } })
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } })
  })
}

// A step-up grant lives for five minutes and is shared by everything that user
// does, so one spec proving its identity would silently let the next spec walk
// past the account gate. Cleared up front so each run sees the same state.
export async function resetStepUp(email: string): Promise<void> {
  await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) return
    await prisma.stepUpGrant.deleteMany({ where: { userId: user.id } })
  })
}

export async function resetPasskeys(email: string): Promise<void> {
  await withPrisma(async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) return
    await prisma.passkey.deleteMany({ where: { userId: user.id } })
  })
}

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Clears state a local database keeps between runs, in beforeAll since a crashed run never reaches its teardown.

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

// A step-up grant lasts five minutes for everything the user does, so it is cleared before each spec.
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

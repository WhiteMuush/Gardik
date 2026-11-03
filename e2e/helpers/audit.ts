import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Reads the audit actions a user performed, so a spec proves Better Auth's hooks really fire.
export async function auditActionsBy(email: string): Promise<string[]> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
    const rows = await prisma.auditLog.findMany({
      where: { actorUserId: user.id },
      select: { action: true },
      orderBy: { createdAt: "asc" },
    })
    return rows.map((r) => r.action)
  } finally {
    await prisma.$disconnect()
  }
}

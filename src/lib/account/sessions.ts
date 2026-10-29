import type { PrismaClient } from "@prisma/client"
import { describeUserAgent } from "./user-agent"

type Db = Pick<PrismaClient, "session">

export type AccountSession = {
  id: string
  device: string
  ipAddress: string | null
  createdAt: Date
  updatedAt: Date
  current: boolean
}

// Better Auth stores an all-zero address when it cannot read the client IP, which is no address at all.
function knownIp(ip: string | null): string | null {
  return ip && !/^[0:.]*$/.test(ip) ? ip : null
}

// The token is only compared here, never returned, since it is the session credential itself.
export async function listAccountSessions(
  db: Db,
  userId: string,
  currentToken: string,
  now = new Date()
): Promise<AccountSession[]> {
  const rows = await db.session.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, token: true, userAgent: true, ipAddress: true, createdAt: true, updatedAt: true },
  })
  return rows.map((s) => ({
    id: s.id,
    device: describeUserAgent(s.userAgent),
    ipAddress: knownIp(s.ipAddress),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    current: s.token === currentToken,
  }))
}

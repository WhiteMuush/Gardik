import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { rateLimit } from "@/lib/rateLimit"
import type { SiemAlert } from "@/lib/integrations"

const SIEM_RATE_LIMIT = 60
const SIEM_RATE_WINDOW_MS = 60_000
const MAX_ALERTS = 1000

export function checkSiemRateLimit(companyId: string): boolean {
  return rateLimit(`siem:${companyId}`, SIEM_RATE_LIMIT, SIEM_RATE_WINDOW_MS)
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Authenticate a SIEM pull request for one company via its bearer export token.
// Returns true when valid; never throws (a missing/unreadable token is a 401).
export async function authenticateSiem(req: Request, companyId: string): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S.*)$/i)?.[1]
  if (!token) return false

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { siemTokenEnc: true },
  })
  if (!company?.siemTokenEnc) return false

  try {
    const { token: stored } = decryptConfig<{ token: string }>(company.siemTokenEnc)
    return safeEqual(stored, token)
  } catch {
    return false
  }
}

// Most recent alerts for a company, newest first, capped for a bounded payload.
export async function getSiemAlerts(companyId: string, since?: Date): Promise<SiemAlert[]> {
  const alerts = await prisma.alert.findMany({
    where: { companyId, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "desc" },
    take: MAX_ALERTS,
    include: { employee: { select: { email: true } }, breach: { select: { name: true } } },
  })
  return alerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    status: a.status,
    message: a.message,
    employeeEmail: a.employee?.email ?? null,
    breachName: a.breach?.name ?? null,
    createdAt: a.createdAt,
  }))
}

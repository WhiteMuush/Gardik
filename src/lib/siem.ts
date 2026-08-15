import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { decryptConfig } from "@/lib/directory/crypto"
import { rateLimit } from "@/lib/rateLimit"
import { CONTENT_TYPE, formatAlerts, type SiemAlert, type SiemFormat } from "@/lib/integrations"

const SIEM_RATE_LIMIT = 60
const SIEM_RATE_WINDOW_MS = 60_000
const MAX_ALERTS = 1000

export function checkSiemRateLimit(companyId: string): Promise<boolean> {
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

// Push every company's new alerts to its configured HTTPS collector in batches.
// The watermark (siemPushSince) advances only after a successful POST, so a
// failed delivery is retried on the next tick. Raw UDP/TCP syslog sockets are
// not used here; this targets HTTP collectors (Splunk HEC, Sentinel, generic).
export async function runDueSiemPush(now: Date = new Date()): Promise<{ pushed: number }> {
  const companies = await prisma.company.findMany({
    where: { siemPushUrlEnc: { not: null } },
    select: { id: true, siemPushUrlEnc: true, siemPushFormat: true, siemPushSince: true },
  })

  let pushed = 0
  for (const c of companies) {
    const alerts = await getSiemAlerts(c.id, c.siemPushSince ?? undefined)
    if (alerts.length === 0) {
      await prisma.company.update({ where: { id: c.id }, data: { siemPushSince: now } })
      continue
    }
    let url: string
    try {
      url = decryptConfig<{ url: string }>(c.siemPushUrlEnc!).url
    } catch {
      continue
    }
    const format: SiemFormat = c.siemPushFormat === "syslog" ? "syslog" : "cef"
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": CONTENT_TYPE[format] },
        body: formatAlerts(alerts, format),
      })
      if (res.ok) {
        await prisma.company.update({ where: { id: c.id }, data: { siemPushSince: now } })
        pushed += alerts.length
      }
    } catch {
      // Leave the watermark; retry next tick.
    }
  }
  return { pushed }
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
    confidence: a.confidence,
    status: a.status,
    message: a.message,
    employeeEmail: a.employee?.email ?? null,
    breachName: a.breach?.name ?? null,
    createdAt: a.createdAt,
  }))
}

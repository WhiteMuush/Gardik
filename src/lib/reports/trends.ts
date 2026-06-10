import { prisma } from "@/lib/prisma"
import { monthKey } from "./utils"
import type { MonthlyPoint, Trends } from "./types"

function emptyMonths(): Map<string, MonthlyPoint> {
  const months = new Map<string, MonthlyPoint>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = monthKey(d)
    months.set(key, { month: key, breaches: 0, alerts: 0 })
  }
  return months
}

export async function getTrends(companyId: string): Promise<Trends> {
  const since = new Date()
  since.setMonth(since.getMonth() - 11)
  since.setDate(1)

  const [records, alerts] = await Promise.all([
    prisma.breachRecord.findMany({
      where: { employee: { companyId }, detectedAt: { gte: since } },
      select: { detectedAt: true },
    }),
    prisma.alert.findMany({
      where: { companyId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ])

  const months = emptyMonths()
  records.forEach((r) => {
    const point = months.get(monthKey(new Date(r.detectedAt)))
    if (point) point.breaches++
  })
  alerts.forEach((a) => {
    const point = months.get(monthKey(new Date(a.createdAt)))
    if (point) point.alerts++
  })

  return { monthly: [...months.values()] }
}

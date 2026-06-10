import { prisma } from "@/lib/prisma"
import { calculateRiskScore, getRiskLevel } from "@/lib/risk"
import { rate } from "./utils"
import type { ExposureSummary, TopBreach } from "./types"

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

function countOpenAlerts(companyId: string, severity: Severity): Promise<number> {
  return prisma.alert.count({ where: { companyId, status: "OPEN", severity } })
}

async function getTopBreaches(companyId: string): Promise<TopBreach[]> {
  const breaches = await prisma.breach.findMany({
    where: { records: { some: { employee: { companyId } } } },
    select: {
      name: true,
      source: true,
      breachDate: true,
      records: { where: { employee: { companyId } }, select: { employeeId: true } },
    },
  })

  return breaches
    .map((b) => ({
      name: b.name,
      source: b.source,
      breachDate: b.breachDate.toISOString(),
      affectedEmployees: new Set(b.records.map((r) => r.employeeId)).size,
    }))
    .sort((a, b) => b.affectedEmployees - a.affectedEmployees)
    .slice(0, 10)
}

export async function getExposureSummary(companyId: string): Promise<ExposureSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [total, exposed, breaches, critical, high, medium, low, recent, topBreaches] =
    await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, breachRecords: { some: {} } } }),
      prisma.breach.count({ where: { records: { some: { employee: { companyId } } } } }),
      countOpenAlerts(companyId, "CRITICAL"),
      countOpenAlerts(companyId, "HIGH"),
      countOpenAlerts(companyId, "MEDIUM"),
      countOpenAlerts(companyId, "LOW"),
      prisma.breachRecord.count({
        where: { employee: { companyId }, detectedAt: { gte: thirtyDaysAgo } },
      }),
      getTopBreaches(companyId),
    ])

  const riskScore = calculateRiskScore({
    totalEmployees: total,
    compromisedEmployees: exposed,
    criticalAlerts: critical,
    highAlerts: high,
    mediumAlerts: medium,
    recentBreaches: recent,
  })

  return {
    totalEmployees: total,
    exposedEmployees: exposed,
    exposureRate: rate(exposed, total),
    totalBreaches: breaches,
    openAlerts: { critical, high, medium, low },
    riskScore,
    riskLabel: getRiskLevel(riskScore).label,
    topBreaches,
  }
}

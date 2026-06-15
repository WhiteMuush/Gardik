import { prisma } from "@/lib/prisma"
import { calculateRiskScore, getRiskLevel } from "@/lib/risk"
import { rate } from "./utils"
import {
  alertWhere,
  breachRecordSome,
  employeeWhere,
  exposedEmployeeWhere,
  type ReportFilters,
} from "./filters"
import type { ExposureSummary, TopBreach } from "./types"

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

function countOpenAlerts(companyId: string, f: ReportFilters, severity: Severity): Promise<number> {
  return prisma.alert.count({ where: { ...alertWhere(companyId, f), status: "OPEN", severity } })
}

async function getTopBreaches(companyId: string, f: ReportFilters): Promise<TopBreach[]> {
  const recordFilter = { employee: employeeWhere(companyId, f), ...breachRecordSome(f) }
  const breaches = await prisma.breach.findMany({
    where: { records: { some: recordFilter } },
    select: {
      name: true,
      source: true,
      breachDate: true,
      records: { where: recordFilter, select: { employeeId: true } },
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

export async function getExposureSummary(companyId: string, f: ReportFilters): Promise<ExposureSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentRecord = { ...breachRecordSome(f), detectedAt: { gte: thirtyDaysAgo } }

  const [total, exposed, breaches, critical, high, medium, low, recent, topBreaches] =
    await Promise.all([
      prisma.employee.count({ where: employeeWhere(companyId, f) }),
      prisma.employee.count({ where: exposedEmployeeWhere(companyId, f) }),
      prisma.breach.count({
        where: { records: { some: { employee: employeeWhere(companyId, f), ...breachRecordSome(f) } } },
      }),
      countOpenAlerts(companyId, f, "CRITICAL"),
      countOpenAlerts(companyId, f, "HIGH"),
      countOpenAlerts(companyId, f, "MEDIUM"),
      countOpenAlerts(companyId, f, "LOW"),
      prisma.breachRecord.count({ where: { employee: employeeWhere(companyId, f), ...recentRecord } }),
      getTopBreaches(companyId, f),
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

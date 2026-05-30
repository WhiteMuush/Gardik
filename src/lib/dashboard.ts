import { prisma } from "@/lib/prisma"

export async function getDashboardData(companyId: string) {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalEmployees,
    compromisedEmployees,
    openAlerts,
    criticalAlerts,
    highAlerts,
    mediumAlerts,
    recentBreaches,
    trendRecords,
    allBreachRecords,
  ] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.employee.count({
      where: { companyId, breachRecords: { some: {} } },
    }),
    prisma.alert.count({ where: { companyId, status: "OPEN" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "CRITICAL" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "HIGH" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "MEDIUM" } }),
    prisma.breachRecord.count({
      where: { employee: { companyId }, detectedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.breachRecord.findMany({
      where: { employee: { companyId }, detectedAt: { gte: sixMonthsAgo } },
      select: { detectedAt: true },
    }),
    prisma.breachRecord.findMany({
      where: { employee: { companyId } },
      select: { exposedData: true },
    }),
  ])

  const riskScore = calculateRiskScore({
    totalEmployees,
    compromisedEmployees,
    criticalAlerts,
    highAlerts,
    mediumAlerts,
    recentBreaches,
  })

  return {
    totalEmployees,
    compromisedEmployees,
    openAlerts,
    recentBreaches,
    riskScore,
    trendData: buildTrendData(trendRecords),
    dataTypes: buildDataTypes(allBreachRecords),
  }
}

export function calculateRiskScore({
  totalEmployees,
  compromisedEmployees,
  criticalAlerts,
  highAlerts,
  mediumAlerts,
  recentBreaches,
}: {
  totalEmployees: number
  compromisedEmployees: number
  criticalAlerts: number
  highAlerts: number
  mediumAlerts: number
  recentBreaches: number
}): number {
  if (totalEmployees === 0) return 0
  const exposureScore = (compromisedEmployees / totalEmployees) * 40
  const alertScore = Math.min(criticalAlerts * 12 + highAlerts * 6 + mediumAlerts * 2, 40)
  const recencyScore = Math.min(recentBreaches * 4, 20)
  return Math.min(Math.round(exposureScore + alertScore + recencyScore), 100)
}

export function getRiskLevel(score: number): {
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  label: string
  variant: "critical" | "high" | "medium" | "ok"
} {
  if (score >= 76) return { level: "CRITICAL", label: "Critical risk", variant: "critical" }
  if (score >= 51) return { level: "HIGH", label: "High risk", variant: "high" }
  if (score >= 26) return { level: "MEDIUM", label: "Medium risk", variant: "medium" }
  return { level: "LOW", label: "Low risk", variant: "ok" }
}

function buildTrendData(records: { detectedAt: Date }[]) {
  const months: Record<string, number> = {}

  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    months[key] = 0
  }

  records.forEach(({ detectedAt }) => {
    const key = new Date(detectedAt).toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (key in months) months[key]++
  })

  return Object.entries(months).map(([month, count]) => ({ month, count }))
}

function buildDataTypes(records: { exposedData: string[] }[]) {
  const counts: Record<string, number> = {}
  const total = records.reduce((sum, r) => sum + r.exposedData.length, 0)

  records.forEach(({ exposedData }) => {
    exposedData.forEach((type) => {
      counts[type] = (counts[type] || 0) + 1
    })
  })

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
}

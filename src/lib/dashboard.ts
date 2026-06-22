import { prisma } from "@/lib/prisma"
import {
  buildEmployeeRiskInput,
  calculateRiskScore,
  employeeRiskScore,
  getRiskLevel,
  resolveRiskWeights,
  type RiskWeights,
} from "@/lib/risk"

export { calculateRiskScore, getRiskLevel }

export async function getDashboardData(companyId: string) {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalEmployees,
    compromisedEmployees,
    openAlerts,
    criticalAlerts,
    highAlerts,
    mediumAlerts,
    lowAlerts,
    recentBreaches,
    trendRecords,
    allBreachRecords,
    breachSources,
    departmentEmployees,
    recentAlerts,
    topRiskyEmployees,
    alertsYearly,
    acknowledgedAlerts,
    resolvedAlerts,
    urgentOpenAlerts,
    alertsForDepartment,
    velocityAlerts,
  ] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId, breachRecords: { some: {} } } }),
    prisma.alert.count({ where: { companyId, status: "OPEN" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "CRITICAL" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "HIGH" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "MEDIUM" } }),
    prisma.alert.count({ where: { companyId, status: "OPEN", severity: "LOW" } }),
    prisma.breachRecord.count({
      where: { employee: { companyId }, detectedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.breachRecord.findMany({
      where: { employee: { companyId }, detectedAt: { gte: twelveMonthsAgo } },
      select: { detectedAt: true },
    }),
    prisma.breachRecord.findMany({
      where: { employee: { companyId } },
      select: { exposedData: true },
    }),
    prisma.breach.findMany({
      where: { records: { some: { employee: { companyId } } } },
      select: {
        id: true, name: true, source: true, breachDate: true, dataTypes: true,
        records: { where: { employee: { companyId } }, select: { employeeId: true } },
      },
      orderBy: { breachDate: "desc" },
    }),
    prisma.employee.findMany({
      where: { companyId },
      select: { department: true, breachRecords: { select: { id: true } } },
    }),
    prisma.alert.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, severity: true, status: true, createdAt: true,
        employee: { select: { firstName: true, lastName: true, department: true } },
        breach: { select: { name: true } },
      },
    }),
    prisma.employee.findMany({
      where: { companyId, breachRecords: { some: {} } },
      select: {
        id: true, firstName: true, lastName: true, department: true, email: true,
        breachRecords: { select: { detectedAt: true, exposedData: true, artifacts: true } },
        alerts: { where: { status: "OPEN" }, select: { severity: true } },
      },
    }),
    // New queries
    prisma.alert.findMany({
      where: { companyId, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, severity: true },
    }),
    prisma.alert.count({ where: { companyId, status: "ACKNOWLEDGED" } }),
    prisma.alert.count({ where: { companyId, status: "RESOLVED" } }),
    prisma.alert.findMany({
      where: { companyId, status: "OPEN", severity: { in: ["CRITICAL", "HIGH"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, severity: true, createdAt: true,
        employee: { select: { firstName: true, lastName: true, department: true } },
        breach: { select: { name: true } },
      },
    }),
    prisma.alert.findMany({
      where: { companyId },
      select: { severity: true, employee: { select: { department: true } } },
    }),
    prisma.alert.findMany({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { domain: true, riskWeights: true },
  })
  const weights = resolveRiskWeights(company?.riskWeights)
  const companyDomain = company?.domain ?? ""

  return {
    totalEmployees,
    compromisedEmployees,
    openAlerts,
    recentBreaches,
    riskScore,
    trendData: buildTrendData(trendRecords),
    dataTypes: buildDataTypes(allBreachRecords),
    alertSeverity: { critical: criticalAlerts, high: highAlerts, medium: mediumAlerts, low: lowAlerts },
    breachSources: breachSources.map((b) => ({
      id: b.id,
      name: b.name,
      source: b.source,
      breachDate: b.breachDate.toISOString(),
      dataTypes: b.dataTypes,
      affectedEmployees: new Set(b.records.map((r) => r.employeeId)).size,
    })),
    departmentRisk: buildDepartmentRisk(departmentEmployees),
    topRiskyEmployees: buildTopRiskyEmployees(topRiskyEmployees, companyDomain, weights),
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : null,
      department: a.employee?.department ?? null,
      breachName: a.breach?.name ?? null,
    })),
    // New data fields
    alertsByMonth: buildAlertsByMonth(alertsYearly),
    alertStatusCounts: { open: openAlerts, acknowledged: acknowledgedAlerts, resolved: resolvedAlerts },
    urgentAlerts: urgentOpenAlerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      createdAt: a.createdAt.toISOString(),
      employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : null,
      department: a.employee?.department ?? null,
      breachName: a.breach?.name ?? null,
    })),
    alertsByDepartment: buildAlertsByDepartment(alertsForDepartment),
    employeeExposureLevels: buildEmployeeExposureLevels(departmentEmployees),
    alertVelocityData: buildAlertVelocity(velocityAlerts),
  }
}

function buildTrendData(records: { detectedAt: Date }[]) {
  const months: Record<string, number> = {}

  for (let i = 11; i >= 0; i--) {
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

type EmployeeRaw = {
  id: string
  firstName: string
  lastName: string
  department: string | null
  email: string
  breachRecords: { detectedAt: Date; exposedData: string[]; artifacts: string[] }[]
  alerts: { severity: string }[]
}

function buildTopRiskyEmployees(employees: EmployeeRaw[], companyDomain: string, weights: RiskWeights) {
  return employees
    .map((e) => {
      const score = employeeRiskScore(
        buildEmployeeRiskInput({
          email: e.email,
          companyDomain,
          records: e.breachRecords,
          openAlerts: e.alerts.length,
        }),
        weights
      )
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department,
        breachCount: e.breachRecords.length,
        openAlerts: e.alerts.length,
        riskScore: score,
        riskLevel: getRiskLevel(score).label,
        riskVariant: getRiskLevel(score).variant,
      }
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
}

function buildDepartmentRisk(employees: { department: string | null; breachRecords: { id: string }[] }[]) {
  const depts: Record<string, { total: number; compromised: number }> = {}

  employees.forEach(({ department, breachRecords }) => {
    const dept = department ?? "Unknown"
    if (!depts[dept]) depts[dept] = { total: 0, compromised: 0 }
    depts[dept].total++
    if (breachRecords.length > 0) depts[dept].compromised++
  })

  return Object.entries(depts)
    .map(([dept, { total, compromised }]) => ({
      department: dept,
      total,
      compromised,
      percentage: total > 0 ? Math.round((compromised / total) * 100) : 0,
    }))
    .sort((a, b) => b.compromised - a.compromised)
    .slice(0, 8)
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

function buildAlertsByMonth(alerts: { createdAt: Date; severity: string }[]) {
  const months: Record<string, { month: string; critical: number; high: number; medium: number; low: number }> = {}

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    months[key] = { month: key, critical: 0, high: 0, medium: 0, low: 0 }
  }

  alerts.forEach(({ createdAt, severity }) => {
    const key = new Date(createdAt).toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (!(key in months)) return
    const s = severity.toLowerCase() as "critical" | "high" | "medium" | "low"
    if (s in months[key]) months[key][s]++
  })

  return Object.values(months)
}

function buildAlertsByDepartment(
  alerts: { severity: string; employee: { department: string | null } | null }[]
) {
  const depts: Record<string, { critical: number; high: number; medium: number; low: number; total: number }> = {}

  alerts.forEach(({ severity, employee }) => {
    const dept = employee?.department ?? "Unknown"
    if (!depts[dept]) depts[dept] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    depts[dept].total++
    const s = severity.toLowerCase() as "critical" | "high" | "medium" | "low"
    if (s in depts[dept]) depts[dept][s]++
  })

  return Object.entries(depts)
    .map(([department, counts]) => ({ department, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
}

function buildEmployeeExposureLevels(employees: { breachRecords: { id: string }[] }[]) {
  return employees.reduce(
    (acc, e) => {
      if (e.breachRecords.length === 0) acc.none++
      else if (e.breachRecords.length === 1) acc.one++
      else acc.multiple++
      return acc
    },
    { none: 0, one: 0, multiple: 0 }
  )
}

function buildAlertVelocity(alerts: { createdAt: Date }[]) {
  const days: Record<string, number> = {}

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    days[key] = 0
  }

  alerts.forEach(({ createdAt }) => {
    const key = new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (key in days) days[key]++
  })

  return Object.entries(days).map(([day, count]) => ({ day, count }))
}

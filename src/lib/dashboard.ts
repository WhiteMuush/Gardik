import { prisma } from "@/lib/prisma"
import {
  buildEmployeeRiskInput,
  calculateRiskScore,
  employeeRiskScore,
  getRiskLevel,
  resolveRiskWeights,
  type RiskWeights,
} from "@/lib/risk"
import type { ApiProvider } from "@prisma/client"

export { calculateRiskScore, getRiskLevel }

// Raw, provider-tagged datasets the source-filterable widgets are derived from.
// A record/breach "belongs" to a provider when that provider reported it
// (BreachRecord.sources). Legacy records with no source tag only appear under
// the unfiltered "all" view.
export type BreachRecordRaw = { detectedAt: Date; exposedData: string[]; sources: ApiProvider[] }
export type BreachCatalogEntry = {
  id: string
  name: string
  source: string
  breachDate: Date
  dataTypes: string[]
  records: { employeeId: string; sources: ApiProvider[] }[]
}

function matchesProvider(sources: ApiProvider[], provider?: ApiProvider): boolean {
  return !provider || sources.includes(provider)
}

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
    breachRecordsRaw,
    breachCatalog,
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
      where: { employee: { companyId } },
      select: { detectedAt: true, exposedData: true, sources: true },
    }),
    prisma.breach.findMany({
      where: { records: { some: { employee: { companyId } } } },
      select: {
        id: true, name: true, source: true, breachDate: true, dataTypes: true,
        records: { where: { employee: { companyId } }, select: { employeeId: true, sources: true } },
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

  const [mfaEnabledCount, mfaDisabledCount, exposedWithoutMfa] = await Promise.all([
    prisma.employee.count({ where: { companyId, mfaEnabled: true } }),
    prisma.employee.count({ where: { companyId, mfaEnabled: false } }),
    prisma.employee.count({ where: { companyId, mfaEnabled: false, breachRecords: { some: {} } } }),
  ])
  const mfaCoverage = {
    enabled: mfaEnabledCount,
    disabled: mfaDisabledCount,
    unknown: Math.max(0, totalEmployees - mfaEnabledCount - mfaDisabledCount),
    exposedWithoutMfa,
    total: totalEmployees,
  }

  return {
    totalEmployees,
    compromisedEmployees,
    openAlerts,
    recentBreaches,
    riskScore,
    // Raw datasets so the page can re-derive the filterable widgets per provider.
    breachRecordsRaw,
    breachCatalog,
    // Default ("all providers") slices.
    trendData: buildTrendData(breachRecordsRaw),
    dataTypes: buildDataTypes(breachRecordsRaw),
    alertSeverity: { critical: criticalAlerts, high: highAlerts, medium: mediumAlerts, low: lowAlerts },
    breachSources: buildBreachSources(breachCatalog),
    departmentRisk: buildDepartmentRisk(departmentEmployees),
    mfaCoverage,
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

export function buildTrendData(records: BreachRecordRaw[], provider?: ApiProvider) {
  const months: Record<string, number> = {}

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    months[key] = 0
  }

  records.forEach(({ detectedAt, sources }) => {
    if (!matchesProvider(sources, provider)) return
    const key = new Date(detectedAt).toLocaleString("en-US", { month: "short", year: "2-digit" })
    if (key in months) months[key]++
  })

  return Object.entries(months).map(([month, count]) => ({ month, count }))
}

// Breaches affecting the company, optionally scoped to a single provider: a
// breach only appears when at least one of its records was reported by that
// provider, and the affected-employee count is computed over matching records.
export function buildBreachSources(catalog: BreachCatalogEntry[], provider?: ApiProvider) {
  return catalog
    .map((b) => ({
      entry: b,
      employees: new Set(
        b.records.filter((r) => matchesProvider(r.sources, provider)).map((r) => r.employeeId)
      ),
    }))
    .filter((x) => x.employees.size > 0)
    .map(({ entry, employees }) => ({
      id: entry.id,
      name: entry.name,
      source: entry.source,
      breachDate: entry.breachDate.toISOString(),
      dataTypes: entry.dataTypes,
      affectedEmployees: employees.size,
    }))
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

export function buildDataTypes(records: BreachRecordRaw[], provider?: ApiProvider) {
  const counts: Record<string, number> = {}
  const matching = records.filter((r) => matchesProvider(r.sources, provider))
  const total = matching.reduce((sum, r) => sum + r.exposedData.length, 0)

  matching.forEach(({ exposedData }) => {
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

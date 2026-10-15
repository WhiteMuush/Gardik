import { prisma } from "@/lib/prisma"
import { calculateRiskScore, resolveRiskWeights } from "@/lib/risk"
import { buildBreachSources, buildDataTypes, buildTrendData } from "@/lib/dashboard-series"
import {
  buildAlertVelocity,
  buildAlertsByDepartment,
  buildAlertsByMonth,
  buildDepartmentRisk,
  buildEmployeeExposureLevels,
  buildTopRiskyEmployees,
} from "@/lib/dashboard-breakdowns"

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
        id: true,
        name: true,
        source: true,
        breachDate: true,
        dataTypes: true,
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
        id: true,
        severity: true,
        status: true,
        createdAt: true,
        employee: { select: { firstName: true, lastName: true, department: true } },
        breach: { select: { name: true } },
      },
    }),
    prisma.employee.findMany({
      where: { companyId, breachRecords: { some: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        email: true,
        breachRecords: { select: { detectedAt: true, exposedData: true, artifacts: true } },
        alerts: { where: { status: "OPEN" }, select: { severity: true } },
      },
    }),
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
        id: true,
        severity: true,
        createdAt: true,
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
    // Raw datasets, so the page can re-derive the source-filterable widgets per provider.
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

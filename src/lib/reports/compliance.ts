import { prisma } from "@/lib/prisma"
import { rate } from "./utils"
import { alertWhere, employeeWhere, exposedEmployeeWhere, type ReportFilters } from "./filters"
import type { ComplianceSummary } from "./types"

export async function getCompliance(companyId: string, f: ReportFilters): Promise<ComplianceSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const base = alertWhere(companyId, f)

  const [monitored, exposed, total, open, acknowledged, resolved, criticalOpen, staleCriticalOpen] =
    await Promise.all([
      prisma.employee.count({ where: employeeWhere(companyId, f) }),
      prisma.employee.count({ where: exposedEmployeeWhere(companyId, f) }),
      prisma.alert.count({ where: base }),
      prisma.alert.count({ where: { ...base, status: "OPEN" } }),
      prisma.alert.count({ where: { ...base, status: "ACKNOWLEDGED" } }),
      prisma.alert.count({ where: { ...base, status: "RESOLVED" } }),
      prisma.alert.count({ where: { ...base, status: "OPEN", severity: "CRITICAL" } }),
      prisma.alert.count({
        where: { ...base, status: "OPEN", severity: "CRITICAL", createdAt: { lt: thirtyDaysAgo } },
      }),
    ])

  return {
    monitoredEmployees: monitored,
    exposedEmployees: exposed,
    exposureRate: rate(exposed, monitored),
    alertsTotal: total,
    alertsOpen: open,
    alertsAcknowledged: acknowledged,
    alertsResolved: resolved,
    resolutionRate: rate(resolved, total),
    criticalOpen,
    staleCriticalOpen,
  }
}

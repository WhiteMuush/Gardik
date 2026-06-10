import { prisma } from "@/lib/prisma"
import { rate } from "./utils"
import type { ComplianceSummary } from "./types"

export async function getCompliance(companyId: string): Promise<ComplianceSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [monitored, exposed, total, open, acknowledged, resolved, criticalOpen, staleCriticalOpen] =
    await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.employee.count({ where: { companyId, breachRecords: { some: {} } } }),
      prisma.alert.count({ where: { companyId } }),
      prisma.alert.count({ where: { companyId, status: "OPEN" } }),
      prisma.alert.count({ where: { companyId, status: "ACKNOWLEDGED" } }),
      prisma.alert.count({ where: { companyId, status: "RESOLVED" } }),
      prisma.alert.count({ where: { companyId, status: "OPEN", severity: "CRITICAL" } }),
      prisma.alert.count({
        where: {
          companyId,
          status: "OPEN",
          severity: "CRITICAL",
          createdAt: { lt: thirtyDaysAgo },
        },
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

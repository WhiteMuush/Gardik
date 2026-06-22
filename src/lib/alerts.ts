import { prisma } from "@/lib/prisma"
import type { Severity, AlertStatus } from "@prisma/client"

// Triage order: unresolved before resolved, then most dangerous, then recent.
const STATUS_RANK: Record<AlertStatus, number> = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 }
const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export type AlertRow = {
  id: string
  severity: Severity
  status: AlertStatus
  message: string
  employeeName: string | null
  employeeEmail: string | null
  breachName: string | null
  createdAt: Date
}

export function getOpenAlertCount(companyId: string): Promise<number> {
  return prisma.alert.count({ where: { companyId, status: "OPEN" } })
}

export async function getAlerts(companyId: string): Promise<AlertRow[]> {
  const alerts = await prisma.alert.findMany({
    where: { companyId },
    include: { employee: true, breach: true },
    orderBy: { createdAt: "desc" },
  })

  alerts.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.createdAt.getTime() - a.createdAt.getTime()
  )

  return alerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    status: a.status,
    message: a.message,
    employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : null,
    employeeEmail: a.employee?.email ?? null,
    breachName: a.breach?.name ?? null,
    createdAt: a.createdAt,
  }))
}

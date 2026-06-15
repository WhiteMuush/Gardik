import { prisma } from "@/lib/prisma"
import type { Severity, AlertStatus } from "@prisma/client"

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

import { prisma } from "@/lib/prisma"
import { executeRemediation, supportsRemediation } from "@/lib/directory/remediation"
import type { RemediationType } from "@prisma/client"

export type RemediationOutcome = { status: "SUCCESS" | "FAILED"; detail: string | null }
export type RemediationResult =
  | { ok: true; outcome: RemediationOutcome }
  | { ok: false; code: "NOT_FOUND" | "NO_EMPLOYEE" | "NO_CAPABLE_CONNECTION" }

// Find an active, capable directory connection for the alert's employee, run the
// action against it, and append the outcome to the audit trail either way. The
// caller is responsible for the remediation-enabled gate and authorization.
export async function remediateAlert(params: {
  companyId: string
  alertId: string
  action: RemediationType
  performedBy: string | null
}): Promise<RemediationResult> {
  const alert = await prisma.alert.findFirst({
    where: { id: params.alertId, companyId: params.companyId },
    include: { employee: { select: { id: true, email: true } } },
  })
  if (!alert) return { ok: false, code: "NOT_FOUND" }
  if (!alert.employee) return { ok: false, code: "NO_EMPLOYEE" }

  const connections = await prisma.directoryConnection.findMany({
    where: { companyId: params.companyId, status: "ACTIVE" },
    select: { type: true, encryptedConfig: true },
  })
  const conn = connections.find((c) => supportsRemediation(c.type, params.action))
  if (!conn) return { ok: false, code: "NO_CAPABLE_CONNECTION" }

  let outcome: RemediationOutcome
  try {
    await executeRemediation(conn.type, conn.encryptedConfig, params.action, alert.employee.email)
    outcome = { status: "SUCCESS", detail: null }
  } catch (e) {
    outcome = { status: "FAILED", detail: (e as Error).message }
  }

  await prisma.remediationAction.create({
    data: {
      companyId: params.companyId,
      employeeId: alert.employee.id,
      alertId: alert.id,
      action: params.action,
      status: outcome.status,
      target: alert.employee.email,
      detail: outcome.detail,
      performedBy: params.performedBy,
    },
  })

  return { ok: true, outcome }
}

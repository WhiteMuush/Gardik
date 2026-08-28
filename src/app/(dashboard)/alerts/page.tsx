import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { getAlerts } from "@/lib/alerts"
import { AlertTable } from "@/components/alerts/AlertTable"

export default async function AlertsPage() {
  const denied = await guardPage("alerts:read")
  if (denied) return denied

  const session = await getSession()
  const companyId = session!.user.companyId
  const [alerts, company, perms] = await Promise.all([
    getAlerts(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { remediationEnabled: true } }),
    permissionsForRole(session!.user.roleId ?? null),
  ])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Alerts</h2>
        <p className="text-sm text-muted-foreground">
          Triage breach detections, acknowledge and resolve incidents
        </p>
      </div>
      <AlertTable
        data={alerts}
        remediationEnabled={company?.remediationEnabled ?? false}
        isAdmin={authorize(perms, "alerts:remediate")}
      />
    </div>
  )
}

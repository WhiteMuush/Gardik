import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getAlerts } from "@/lib/alerts"
import { AlertTable } from "@/components/alerts/AlertTable"

export default async function AlertsPage() {
  const session = await auth()
  const companyId = session!.user.companyId
  const [alerts, company] = await Promise.all([
    getAlerts(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { remediationEnabled: true } }),
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
        isAdmin={session!.user.role === "ADMIN"}
      />
    </div>
  )
}

import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { AccessTabs } from "@/components/rbac/AccessTabs"
import { AlertChannelsPanel } from "@/components/notifications/AlertChannelsPanel"
import { ReportSchedulesPanel } from "@/components/notifications/ReportSchedulesPanel"
import { listWebhooks } from "@/lib/webhooks"

export default async function NotificationsPage() {
  const denied = await guardPage("notifications:read")
  if (denied) return denied

  const session = await getSession()
  const perms = await permissionsForRole(session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "notifications:manage")

  const webhooks = await listWebhooks(session!.user.companyId)

  const schedules = await prisma.reportSchedule.findMany({
    where: { companyId: session!.user.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, frequency: true, recipients: true, sections: true, enabled: true, lastSentAt: true },
  })
  const scheduleRows = schedules.map((s) => ({ ...s, lastSentAt: s.lastSentAt?.toISOString() ?? null }))

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Where Gardik sends alerts and reports, so your team hears about an exposure without opening the app.
        </p>
      </div>

      <AccessTabs
        tabs={[
          {
            id: "alerts",
            label: "Real-time alerts",
            panel: <AlertChannelsPanel initial={webhooks} isAdmin={isAdmin} />,
          },
          {
            id: "reports",
            label: "Scheduled reports",
            panel: <ReportSchedulesPanel initial={scheduleRows} isAdmin={isAdmin} />,
          },
        ]}
      />
    </div>
  )
}

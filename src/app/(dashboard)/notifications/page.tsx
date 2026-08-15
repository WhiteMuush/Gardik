import { guardPage } from "@/lib/rbac/guard-page"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { Webhooks } from "@/components/credentials/Webhooks"
import { ReportSchedules } from "@/components/reports/ReportSchedules"
import { listWebhooks } from "@/lib/webhooks"

export default async function NotificationsPage() {
  const denied = await guardPage("notifications:read")
  if (denied) return denied

  const session = await getSession()
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const isAdmin = authorize(perms, "notifications:manage")

  const webhooks = await listWebhooks(session!.user.companyId)

  const schedules = await prisma.reportSchedule.findMany({
    where: { companyId: session!.user.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, frequency: true, recipients: true, sections: true, enabled: true, lastSentAt: true },
  })
  const scheduleRows = schedules.map((s) => ({ ...s, lastSentAt: s.lastSentAt?.toISOString() ?? null }))

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Where DataShield delivers alerts and reports: webhooks for real-time
          notifications and scheduled report emails.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <Webhooks initial={webhooks} isAdmin={isAdmin} />
        <ReportSchedules initial={scheduleRows} isAdmin={isAdmin} />
      </div>
    </div>
  )
}

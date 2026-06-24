import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Webhooks } from "@/components/credentials/Webhooks"
import { ReportSchedules } from "@/components/reports/ReportSchedules"
import { listWebhooks } from "@/lib/webhooks"

export default async function NotificationsPage() {
  const session = await auth()
  const isAdmin = session!.user.role === "ADMIN"

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

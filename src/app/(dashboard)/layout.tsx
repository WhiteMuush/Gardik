import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
import { Providers } from "@/components/providers"
import { getOpenAlertCount } from "@/lib/alerts"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  // A session can outlive its company row (DB reseed, deleted tenant). Without
  // this check the stale companyId reaches data loaders and crashes every
  // dashboard page; force a re-auth instead.
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { id: true },
  })
  if (!company) redirect("/login")

  const openAlerts = await getOpenAlertCount(session.user.companyId)

  return (
    <Providers>
      <RoutePrefetcher />
      <DashboardShell openAlerts={openAlerts}>
        {children}
      </DashboardShell>
    </Providers>
  )
}

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
import { Providers } from "@/components/providers"
import { getOpenAlertCount } from "@/lib/alerts"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const openAlerts = await getOpenAlertCount(session.user.companyId)

  return (
    <Providers>
      <RoutePrefetcher />
      <DashboardShell
        companyName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        openAlerts={openAlerts}
      >
        {children}
      </DashboardShell>
    </Providers>
  )
}

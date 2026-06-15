import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          companyName={session.user.name ?? ""}
          userEmail={session.user.email ?? ""}
          openAlerts={openAlerts}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
        </div>
      </div>
    </Providers>
  )
}

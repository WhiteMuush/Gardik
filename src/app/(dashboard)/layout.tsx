import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
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
    select: { id: true, require2fa: true },
  })
  if (!company) redirect("/login")

  // Companies can force 2FA enrollment. Route to /setup so the user can
  // enroll, but skip this when already on /setup to avoid a redirect loop.
  const pathname = (await headers()).get("x-pathname") ?? ""
  if (company.require2fa && !session.user.twoFactorEnabled && !pathname.startsWith("/setup")) {
    redirect("/setup?enroll=2fa")
  }

  const openAlerts = await getOpenAlertCount(session.user.companyId)

  return (
    <>
      <RoutePrefetcher />
      <DashboardShell openAlerts={openAlerts}>
        {children}
      </DashboardShell>
    </>
  )
}

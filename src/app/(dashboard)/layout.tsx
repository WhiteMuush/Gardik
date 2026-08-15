import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
import { getOpenAlertCount } from "@/lib/alerts"
import { needsTwoFactorEnrollment } from "@/lib/auth/two-factor-gate"

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

  const pathname = (await headers()).get("x-pathname") ?? ""

  // Ordered before the two-factor gate on purpose: enrolling a second factor
  // asks for the current password, so a user under a forced rotation would be
  // binding an authenticator while still on the password an administrator
  // handed them. Password first, then the second factor.
  if (session.user.mustChangePassword && !pathname.startsWith("/security")) {
    redirect("/security")
  }

  // Companies can force 2FA enrollment. Route to /security so the user can
  // enroll, but skip this when already there to avoid a redirect loop.
  if (
    !pathname.startsWith("/security") &&
    company.require2fa &&
    !session.user.twoFactorEnabled
  ) {
    // Only queried on the path that can redirect, which is the rare one.
    const credential = await prisma.account.findFirst({
      where: { userId: session.user.id, providerId: "credential" },
      select: { id: true },
    })
    const mustEnroll = needsTwoFactorEnrollment({
      companyRequires2fa: company.require2fa,
      userHasTwoFactor: session.user.twoFactorEnabled ?? false,
      userHasPassword: credential !== null,
    })
    if (mustEnroll) redirect("/security")
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

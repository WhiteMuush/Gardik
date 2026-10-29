import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
import { NoAccess } from "@/components/layout/NoAccess"
import { getOpenAlertCount } from "@/lib/alerts"
import { needsTwoFactorEnrollment } from "@/lib/auth/two-factor-gate"
import { authorize } from "@/lib/rbac/authorize"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { requiredPermissionForPage, visiblePages } from "@/lib/rbac/page-permissions"
import { loadPreferences } from "@/lib/preferences/load"
import { TimeZoneProvider } from "@/components/ui/DateTime"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  // A session can outlive its company row (reseed, deleted tenant), so force a re-auth instead of crashing loaders.
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { id: true, require2fa: true },
  })
  if (!company) redirect("/login")

  // Owed steps are settled on /secure; the API guard is the real control, this redirect only a courtesy.
  if (session.user.mustChangePassword || (company.require2fa && !session.user.twoFactorEnabled)) {
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
    // A password-less SSO account owes neither: it cannot satisfy either form.
    if ((session.user.mustChangePassword && credential !== null) || mustEnroll) {
      redirect("/secure")
    }
  }

  // Page authorization for every dashboard page, so an unregistered page is refused rather than left open.
  const pathname = (await headers()).get("x-pathname") ?? ""
  const perms = await permissionsForRole(session.user.roleId ?? null)
  const may = (permission: ReturnType<typeof requiredPermissionForPage>) =>
    permission !== null && (permission === "AUTH_ONLY" || authorize(perms, permission))

  const [openAlerts, prefs] = await Promise.all([
    getOpenAlertCount(session.user.companyId),
    loadPreferences(prisma, session.user.id),
  ])

  // The rail shows exactly the pages the server would open for this user, from the same map.
  const visible = visiblePages(perms)

  return (
    <TimeZoneProvider zone={prefs.timeZone}>
      <RoutePrefetcher visible={visible} />
      <DashboardShell openAlerts={openAlerts} visible={visible}>
        {may(requiredPermissionForPage(pathname)) ? children : <NoAccess />}
      </DashboardShell>
    </TimeZoneProvider>
  )
}

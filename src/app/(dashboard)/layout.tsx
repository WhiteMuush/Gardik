import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher"
import { NoAccess } from "@/components/layout/NoAccess"
import { getOpenAlertCount } from "@/lib/alerts"
import { needsTwoFactorEnrollment } from "@/lib/auth/two-factor-gate"
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { PAGE_PERMISSIONS, requiredPermissionForPage } from "@/lib/rbac/page-permissions"

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

  // Anything a user owes before the dashboard opens (a forced password
  // rotation, a mandatory second factor) is settled on /secure, which lives
  // outside this layout entirely: no sidebar, no other page to wander into
  // while the requirement is outstanding. The API guard refuses those users
  // independently, so this redirect is a courtesy rather than the control.
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

  // Page authorization, enforced here rather than page by page. Every dashboard
  // page renders through this layout, so a page that forgets its own check is
  // still covered, and a page nobody registered is refused rather than left
  // open. Pages keep their finer-grained checks for what to draw once inside.
  const pathname = (await headers()).get("x-pathname") ?? ""
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  const may = (permission: ReturnType<typeof requiredPermissionForPage>) =>
    permission !== null && (permission === "AUTH_ONLY" || authorize(perms, permission))

  const openAlerts = await getOpenAlertCount(session.user.companyId)

  // The rail advertises exactly what the server would let this user open, from
  // the same map: no entry that leads to a refusal, and no hidden entry that
  // would have worked.
  const visible = Object.keys(PAGE_PERMISSIONS).filter((path) => may(PAGE_PERMISSIONS[path]))

  return (
    <>
      <RoutePrefetcher />
      <DashboardShell openAlerts={openAlerts} visible={visible}>
        {may(requiredPermissionForPage(pathname)) ? children : <NoAccess />}
      </DashboardShell>
    </>
  )
}

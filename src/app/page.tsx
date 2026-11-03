import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { landingPath, visiblePages } from "@/lib/rbac/page-permissions"
import { prisma } from "@/lib/prisma"
import { loadPreferences } from "@/lib/preferences/load"
import { resolveHomePage } from "@/lib/preferences/apply"

// The one place deciding where a signed-in person starts, from what their role can open.
export default async function Home() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [perms, prefs] = await Promise.all([
    permissionsForRole(session.user.roleId ?? null),
    loadPreferences(prisma, session.user.id),
  ])
  redirect(resolveHomePage(prefs.homePage, visiblePages(perms), landingPath(perms)))
}

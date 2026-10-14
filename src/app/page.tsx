import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { permissionsForRole } from "@/lib/rbac/session-permissions"
import { landingPath } from "@/lib/rbac/page-permissions"

// The one place deciding where a signed-in person starts, from what their role can open.
export default async function Home() {
  const session = await getSession()
  if (!session) redirect("/login")

  const perms = await permissionsForRole(session.user.roleId ?? null)
  redirect(landingPath(perms))
}

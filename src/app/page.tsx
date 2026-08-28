import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "@/lib/rbac/authorize"
import { landingPath } from "@/lib/rbac/page-permissions"

// The one place that decides where a signed-in person starts. Every path that
// used to send someone to /dashboard now comes through here instead, so the
// choice is made once, on the server, from what the role can actually open.
export default async function Home() {
  const session = await getSession()
  if (!session) redirect("/login")

  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  redirect(landingPath(perms))
}

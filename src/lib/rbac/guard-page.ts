import type { ReactElement } from "react"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, authorize } from "./authorize"
import type { Permission } from "./permissions"
import { NoAccess } from "@/components/layout/NoAccess"

// Await it first in every gated page, since the layout check cannot stop the page from sending its data.
export async function guardPage(permission: Permission): Promise<ReactElement | null> {
  const session = await getSession()
  if (!session) return NoAccess()

  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  return authorize(perms, permission) ? null : NoAccess()
}
